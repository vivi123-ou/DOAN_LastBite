-- Additive migration (see .claude/rules/database-and-schema.md — 0001-0023
-- are applied and never edited). Adds Messenger-style unread-message
-- tracking for the 1:1 chat feature (0010) — "/friends" had no way to show
-- which threads have new messages, and no way to clear that once a thread
-- was actually opened.
--
-- One row per (friendship, user) recording "when did I last read this
-- thread" rather than a read flag on every message row — a 1:1 thread only
-- ever needs a single watermark timestamp per reader, not per-message read
-- state, so opening a chat is one small upsert instead of updating every
-- unread message row.
create table friendship_reads (
  friendship_id uuid not null references friendships (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (friendship_id, user_id)
);

alter table friendship_reads enable row level security;

create policy friendship_reads_select_own on friendship_reads
  for select using (user_id = auth.uid());

create policy friendship_reads_insert_own on friendship_reads
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from friendships f
      where f.id = friendship_reads.friendship_id
        and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
    )
  );

create policy friendship_reads_update_own on friendship_reads
  for update using (user_id = auth.uid());

-- Not SECURITY DEFINER — runs under the calling role's own RLS, same
-- posture as any other query (unlike search_profiles(), which is only ever
-- called through the service-role client for a different reason). No
-- user_id argument is needed or accepted, always auth.uid() directly — so
-- messages_select_thread/friendships_select_own already restrict every row
-- this can ever touch to threads the caller is genuinely a party to.
create function unread_message_counts()
returns table (friendship_id uuid, unread_count bigint)
language sql stable as $$
  select m.friendship_id, count(*) as unread_count
  from messages m
  join friendships f on f.id = m.friendship_id
  left join friendship_reads r on r.friendship_id = m.friendship_id and r.user_id = auth.uid()
  where (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
    and m.sender_id <> auth.uid()
    and m.created_at > coalesce(r.last_read_at, 'epoch'::timestamptz)
  group by m.friendship_id;
$$;
