-- =====================================================================
-- SaccoSense: MEMBER ACCOUNT ACTIVATION  (supabase/member-activation.sql)
--
-- Run ONCE in the Supabase SQL Editor, AFTER member-management.sql.
--
-- The flow:
--   1. The admin adds a member record (Members page). No login exists yet.
--   2. The member opens pages/activate.html, types the SAME email and
--      chooses a password. The page calls Supabase signUp().
--   3. Supabase creates the login in auth.users. The trigger below runs
--      automatically and links that login to the member record whose
--      email matches (creates their row in `profiles` with role 'member').
--   4. The member clicks the confirmation link Supabase emails them,
--      then logs in normally on the login page.
--
-- What this file creates:
--   1. check_activation_email()  - lets the activate page tell the member
--                                   whether their email can be activated
--   2. link_new_member_login()   - the trigger function for step 3
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. CHECK AN EMAIL BEFORE ACTIVATING
--    The activate page is used by people who are NOT logged in ("anon").
--    RLS stops anon from reading `members` at all, which is what we want.
--    So instead of opening the table, we give anon this ONE function.
--    It answers with a single word and never returns any member data:
--      'not_member'        -> no member record has this email
--      'already_activated' -> a login with this email already exists
--      'ok'                -> this email can be activated
--    "security definer" lets it look inside members / auth.users even
--    though the caller can't.
-- ---------------------------------------------------------------------

create function public.check_activation_email(p_email text)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
    v_email text := lower(trim(p_email));
begin
    if not exists (select 1 from members where email = v_email) then
        return 'not_member';
    end if;

    -- auth.users is Supabase's own table of login accounts
    if exists (select 1 from auth.users where lower(email) = v_email) then
        return 'already_activated';
    end if;

    return 'ok';
end;
$$;

-- anon = visitors who are not logged in (the activate page)
revoke execute on function public.check_activation_email(text) from public;
grant  execute on function public.check_activation_email(text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 2. LINK A NEW LOGIN TO ITS MEMBER RECORD
--    This trigger runs AFTER every new row in auth.users (every signUp,
--    and also every user created in the Supabase dashboard).
--
--    SECURITY:
--    - It only ever creates the role 'member', never 'admin'. Admins are
--      still created by hand (link-users.sql).
--    - It only links when the email matches a member record.
--    - The member can't log in until they click the confirmation email,
--      which proves they own that inbox. That is why "Confirm email" must
--      stay ON in Supabase (Authentication -> Sign In / Providers -> Email).
-- ---------------------------------------------------------------------

create function public.link_new_member_login()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
    insert into profiles (id, role, full_name, member_id)
    select new.id, 'member', m.full_name, m.member_id
      from members m
     where m.email = lower(new.email)
       -- skip if this member record is somehow already linked to a login
       and not exists (select 1 from profiles p where p.member_id = m.member_id)
    on conflict (id) do nothing;

    -- No matching member? Do nothing. The login exists but has no role,
    -- so the login page refuses it ("not been given access yet").
    return new;
end;
$$;

create trigger on_auth_user_created_link_member
    after insert on auth.users
    for each row execute function public.link_new_member_login();
