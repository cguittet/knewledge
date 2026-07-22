# Supabase integration tests

Run these checks against a disposable local Supabase stack after `supabase start` and `supabase db reset`:

1. Create two unused invites and sign up two users through magic links.
2. Insert one capture and object per user using each user's JWT.
3. Assert each user can read only their own profile, settings, captures, assets, chunks, topics, digests, pairings, and storage prefix.
4. Assert anonymous reads return no rows and cross-prefix storage access fails.
5. Call `soft_delete_capture` as the owner and verify immediate invisibility plus one cleanup job; call as the other user and verify no mutation.
6. Insert the same `(user_id, period_end)` twice and verify the digest uniqueness constraint.
7. Attempt signup without an invite and verify no auth user or profile survives the transaction.

These tests intentionally use real JWT/RLS behavior rather than service-role access.
