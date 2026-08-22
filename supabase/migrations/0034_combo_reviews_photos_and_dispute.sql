-- Two remaining gaps flagged for combo_reviews (CLAUDE.md's "Next steps"):
-- no photo attachments on a review/report, and no way for a store owner to
-- respond to/dispute a report they think is unfair before an admin looks
-- at it. Both additive on top of 0015/0026, no columns removed or renamed.

-- Photos for either kind — a review photo shows real proof of what was
-- received (extends the same "no mystery bags" transparency combo_images
-- already gives at listing time, now at review time too); a report photo
-- is evidence for the store/admin. Plain text[], not a separate table —
-- this app already has this exact shape (combos.image gallery is its own
-- table only because a combo's *listing* photos need independent ordering/
-- lifecycle; a review's photos are always fixed at submission time, never
-- edited individually, so an array column is proportionate here).
alter table combo_reviews add column image_urls text[] not null default '{}';

-- Lets a store owner post one written response to a report about their own
-- store, before or instead of an admin ever looking at it — the "moderation/
-- appeal" gap: today a report only ever went customer -> admin, with the
-- store owner able to *see* it (0015) but never respond. Nullable — most
-- reports may never get one.
alter table combo_reviews add column store_response text;
alter table combo_reviews add column store_responded_at timestamptz;

-- Store owners can already SELECT their own store's reports (0015's
-- combo_reviews_select_store_owner) — this adds the matching UPDATE, same
-- ownership-join shape, so they can actually post the response above.
-- No WITH CHECK restricting which columns get touched, same posture as
-- every other loosely-scoped update policy in this schema (e.g.
-- friendships_update_addressee/_either_party) — the application layer
-- (review.repository.ts's respondToReport(), only ever sent from the store
-- dashboard's report reply form) is what constrains the update payload to
-- just {store_response, store_responded_at}, not RLS.
create policy combo_reviews_update_store_owner on combo_reviews
  for update using (
    exists (select 1 from stores s where s.id = combo_reviews.store_id and s.owner_id = auth.uid())
  );

-- New bucket, not a reuse of combo-images (0003) — that bucket's write
-- policy requires the uploader to *own the store* (path prefix parsed back
-- to stores.owner_id); a review/report photo is uploaded by the customer,
-- who owns neither the store nor (usually) any combo row. Same direct
-- auth.uid()-path-match shape as avatars (0007), not combo-images' cross-
-- table ownership join — a customer only ever owns their own uploads here,
-- no join needed.
insert into storage.buckets (id, name, public)
values ('review-images', 'review-images', true)
on conflict (id) do nothing;

create policy review_images_bucket_public_read on storage.objects
  for select using (bucket_id = 'review-images');

create policy review_images_bucket_own_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'review-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy review_images_bucket_own_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'review-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
