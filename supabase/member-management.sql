-- =====================================================================
-- SaccoSense: MEMBER MANAGEMENT database update  (stage 4)
--
-- Run ONCE in the Supabase SQL Editor, AFTER schema.sql.
-- It changes the existing `members` table; it does not delete any data.
--
-- What it does:
--   1. Adds the new member fields (national ID, date of birth, address).
--   2. Makes the database generate Member IDs (SS-0021, SS-0022, ...).
--   3. Limits which columns the browser may write, so the savings
--      balance and Member ID can never be typed in or edited directly.
--   4. Tidies input and locks the email once the member has a login.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. NEW FIELDS
-- ---------------------------------------------------------------------

alter table public.members
    add column national_id   text,          -- required (made NOT NULL below)
    add column date_of_birth date,          -- optional
    add column address       text;          -- optional (physical address)

-- The 20 sample members have no national ID yet, so give them
-- placeholder numbers (SS-0001 -> 30000001, SS-0011 -> 30000011, ...).
-- Without this, the NOT NULL rule below would fail on the existing rows.
update public.members
   set national_id = (30000000 + substring(member_id from 4)::int)::text
 where national_id is null;

-- Now every row has one, so we can make it required and unique
alter table public.members
    alter column national_id set not null,
    add constraint members_national_id_key unique (national_id),
    -- phone was optional before; registration now requires it
    alter column phone set not null;


-- ---------------------------------------------------------------------
-- 2. AUTOMATIC MEMBER IDs
--    A "sequence" is a counter kept by the database. Each call to
--    nextval() returns the next number, even if two admins register
--    members at the same moment, so IDs can never be duplicated.
-- ---------------------------------------------------------------------

create sequence public.member_number_seq;

-- Start counting after the highest existing number (SS-0020 -> next is 21)
select setval(
    'public.member_number_seq',
    (select max(substring(member_id from 4)::int) from public.members)
);

-- If an insert doesn't supply a member_id, the database builds one
alter table public.members
    alter column member_id
    set default 'SS-' || lpad(nextval('public.member_number_seq')::text, 4, '0');


-- ---------------------------------------------------------------------
-- 3. COLUMN-LEVEL PERMISSIONS
--    The RLS policies in schema.sql already say "only admins may insert
--    or update members". But they allowed ANY column to be written,
--    including savings_balance. Here we list exactly which columns the
--    browser may fill in. Everything else is controlled by the database:
--      member_id        -> generated (section 2)
--      savings_balance  -> only changed by record_transaction()
--      joined_at        -> defaults to today
-- ---------------------------------------------------------------------

revoke insert, update on public.members from authenticated, anon;

grant insert (full_name, national_id, phone, email, date_of_birth, address)
    on public.members to authenticated;

-- status is editable (active / inactive) but not set on registration
grant update (full_name, national_id, phone, email, date_of_birth, address, status)
    on public.members to authenticated;

-- The sequence must be usable by the logged-in admin for the default to work
grant usage on sequence public.member_number_seq to authenticated;


-- ---------------------------------------------------------------------
-- 4. INPUT CLEAN-UP AND EMAIL LOCK
--    A "trigger" is a function the database runs automatically,
--    here BEFORE every insert or update on members.
-- ---------------------------------------------------------------------

create function public.members_before_save()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
    -- tidy the input: trim spaces, store emails in lowercase
    new.full_name   := trim(new.full_name);
    new.national_id := trim(new.national_id);
    new.phone       := trim(new.phone);
    new.email       := lower(trim(new.email));
    new.address     := nullif(trim(new.address), '');

    if new.full_name = '' then
        raise exception 'Full name is required.';
    end if;
    if new.date_of_birth is not null and new.date_of_birth > current_date then
        raise exception 'Date of birth cannot be in the future.';
    end if;

    -- Once a member has activated a login, their email is tied to it.
    -- Changing it here would break the link, so block it.
    if tg_op = 'UPDATE'
       and new.email is distinct from old.email
       and exists (select 1 from profiles where member_id = old.member_id) then
        raise exception 'This member has already activated their account, so their email cannot be changed.';
    end if;

    return new;
end;
$$;

create trigger members_before_save
    before insert or update on public.members
    for each row execute function public.members_before_save();
