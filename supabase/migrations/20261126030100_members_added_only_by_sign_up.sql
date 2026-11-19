-- A member record is made only by sign-up (#1019): staff with members.manage could insert one through the API (policy
-- "member managers add members" and its column grants, 20261018090400_tiers_and_members.sql), and such a row got no
-- welcome and skipped sign_up's checks. No app inserts a member row; staff keep changing one (members.manage).
drop policy "member managers add members" on public.member;
revoke insert on public.member from authenticated;
