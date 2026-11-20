-- =====================================================================
-- LINK LOGIN ACCOUNTS TO ROLES  (supabase/link-users.sql)
--
-- Run this AFTER creating users in Supabase:
--   Authentication -> Users -> Add user -> Create new user
--   (tick "Auto Confirm User")
--
-- It creates a profile row (the user's role) for each login account.
-- Safe to run again whenever you add more users.
-- =====================================================================

-- 1. ADMIN: change the email below if you used a different admin email
insert into public.profiles (id, role, full_name)
select id, 'admin', 'Grace Wanjiku'
from auth.users
where lower(email) = lower('admin@example.com')
on conflict (id) do nothing;

-- 2. MEMBERS: any login whose email matches a member record
--    becomes that member (e.g. brian.odhiambo@example.com -> SS-0011)
insert into public.profiles (id, role, full_name, member_id)
select u.id, 'member', m.full_name, m.member_id
from auth.users u
join public.members m on lower(m.email) = lower(u.email)
on conflict (id) do nothing;

-- 3. Check the result: you should see one admin and one member row
select p.role, p.full_name, p.member_id, u.email
from public.profiles p join auth.users u on u.id = p.id;
