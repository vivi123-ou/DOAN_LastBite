-- Additive migration (see .claude/rules/database-and-schema.md — 0001-0009
-- are applied and never edited). Friends + 1:1 messaging is genuinely new
-- product surface, not something the phase-1 forward-planning schema
-- anticipated (only group_orders/group_order_participants existed for
-- phase-4 group-buy) — the user explicitly chose the full build over
-- scoping down to just group-buy, see CLAUDE.md §7.
--
-- `friendships` doubles as the 1:1 conversation thread once accepted — no
-- separate `conversations` table, since a friendship *is* a conversation
-- for this app's scope (no group chats, no messaging strangers).
-- `messages.group_order_id` lets a message optionally carry a "mời mua
-- chung" invite card, tying straight into the existing dormant
-- group_orders/group_order_participants tables instead of inventing a
-- parallel invite system.

create table friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles (id) on delete cascade,
  addressee_id uuid not null references profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friendships_no_self check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);

create index idx_friendships_requester on friendships (requester_id, status);
create index idx_friendships_addressee on friendships (addressee_id, status);

create table messages (
  id uuid primary key default gen_random_uuid(),
  friendship_id uuid not null references friendships (id) on delete cascade,
  sender_id uuid not null references profiles (id) on delete cascade,
  body text not null,
  group_order_id uuid references group_orders (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_messages_friendship on messages (friendship_id, created_at);

-- Trigram search on display name to find people to friend — same
-- expression shape as idx_combos_name_trgm/idx_stores_name_trgm (0001) so
-- the index is actually used, per database-and-schema.md's search rule.
-- Search itself goes through the service-role client (friend.repository.ts
-- searchUsers()), not a new client-facing RLS policy — profiles' existing
-- policies are deliberately narrow (own row, or the phase-2 store-owner
-- exception in 0005), and a "search all users" policy would widen that in
-- a way this feature doesn't actually need.
create index idx_profiles_full_name_trgm on profiles using gin (lower(f_unaccent(full_name)) gin_trgm_ops);

alter table friendships enable row level security;

-- A user can see a friendship row iff they're one of the two parties.
create policy friendships_select_own on friendships
  for select using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy friendships_insert_own on friendships
  for insert with check (requester_id = auth.uid());
-- Only the addressee responds to a pending request (accept/reject).
create policy friendships_update_addressee on friendships
  for update using (addressee_id = auth.uid());

alter table messages enable row level security;

-- Ownership join against friendships, not a duplicated participant column
-- on messages — same style as the rest of the schema's RLS.
create policy messages_select_thread on messages
  for select using (
    exists (
      select 1 from friendships f
      where f.id = messages.friendship_id
        and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
    )
  );
create policy messages_insert_own on messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from friendships f
      where f.id = messages.friendship_id
        and f.status = 'accepted'
        and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
    )
  );

-- Enables Supabase Realtime postgres_changes delivery for new messages —
-- the chat UI subscribes per friendship_id (message.repository.ts /
-- app/(customer)/friends/[friendshipId]/_components/chat-view.tsx).
alter publication supabase_realtime add table messages;

-- Not SECURITY DEFINER — runs under the calling role's own RLS, same as
-- any other query. Called only from friend.repository.ts's searchUsers()
-- via the service-role client (which bypasses RLS regardless), so it sees
-- every profile there; if a client ever called this RPC directly instead,
-- profiles' existing narrow RLS would still apply and it'd just see
-- whatever that caller's own policies already allow — no new exposure.
create function search_profiles(
  in_query text,
  exclude_user_id uuid,
  max_results int default 10
) returns table (
  user_id uuid,
  full_name text,
  avatar_url text
)
language sql stable as $$
  select id, full_name, avatar_url
  from profiles
  where id <> exclude_user_id
    and full_name is not null
    and lower(f_unaccent(full_name)) ilike '%' || lower(f_unaccent(in_query)) || '%'
  order by full_name
  limit max_results;
$$;
