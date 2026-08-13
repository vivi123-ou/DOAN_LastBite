-- Additive migration (0001-0017 applied and never edited). Real gap caught
-- live: 0010_friends_messages.sql gave `friendships` select/insert/update
-- (addressee-only, for accept/reject) policies, but no delete policy at
-- all — so there was no way to cancel a sent request or unfriend an
-- existing accepted friendship from the client, even though the UI now
-- needs both (see friends-view.tsx).
--
-- Either party can delete a friendship row they're part of — covers both
-- "cancel my own still-pending outgoing request" and "unfriend an accepted
-- friendship" with one policy, same permissive-both-parties shape already
-- used by friendships_select_own. `messages.friendship_id` cascades on
-- delete (0010), so unfriending also clears that thread's message history —
-- intentional, a friendship *is* the conversation in this app's scope.
create policy friendships_delete_own on friendships
  for delete using (requester_id = auth.uid() or addressee_id = auth.uid());
