-- Two real gaps flagged in the friends/messaging area (CLAUDE.md's "Next
-- steps"): no way to block someone, and a rejected friendship's own
-- unique(requester_id, addressee_id) constraint (0010) permanently blocks
-- a fresh request between the same two people even long after the
-- rejection, with nothing to delete the stale row and free it up.
--
-- Deliberately a nullable column, not a new 'blocked' value in the
-- existing status check — status stays exactly what it already meant
-- (pending/accepted/rejected are still the only real "what stage is this
-- friendship at" states); blocked_by is an orthogonal flag layered on top
-- ("regardless of stage, has one party silenced the other"), avoiding any
-- need to touch the original inline check constraint (whose auto-generated
-- name isn't worth guessing at to ALTER, per this project's own additive-
-- only migration discipline).
alter table friendships add column blocked_by uuid references profiles (id);

-- Either party can update a friendship row they're part of — needed for
-- two app-layer flows: blockUserAction (either side can be the one who
-- blocks) and "gửi lại lời mời sau khi bị từ chối" (the resend flow reuses
-- the existing rejected row via UPDATE rather than a fresh INSERT, since
-- the unique constraint would otherwise reject a duplicate pair). Same
-- posture as the existing friendships_update_addressee policy (0010): no
-- WITH CHECK restricting which columns/values get set — the application
-- layer (friend.repository.ts) is what decides which update payloads are
-- legitimate, not RLS, consistent with how this table has always worked.
create policy friendships_update_either_party on friendships
  for update using (requester_id = auth.uid() or addressee_id = auth.uid());
