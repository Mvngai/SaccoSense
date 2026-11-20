-- =====================================================================
-- SaccoSense DATABASE SCHEMA  (supabase/schema.sql)
--
-- HOW TO USE: Supabase dashboard -> SQL Editor -> New query ->
-- paste this whole file -> Run. Run it ONCE on a fresh project
-- (running it again would fail because the tables already exist).
--
-- What it creates:
--   1. Tables: members, transactions, loans, notifications, profiles
--   2. Helper functions: is_admin(), my_member_id()
--   3. Row Level Security (RLS) policies - the REAL security:
--        admins can read everything,
--        members can only read their own rows.
--   4. Functions the app calls: record_transaction(), mark_notifications_read()
--   5. The same sample data the prototype used (js/data.js)
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. TABLES  (same field names as the old js/data.js records)
-- ---------------------------------------------------------------------

create table public.members (
    member_id       text primary key,                 -- e.g. SS-0011
    full_name       text not null,
    phone           text,
    email           text not null unique,
    joined_at       date not null default current_date,
    status          text not null default 'active' check (status in ('active', 'inactive')),
    savings_balance numeric(14,2) not null default 0 check (savings_balance >= 0)
);

create table public.transactions (
    transaction_id  text primary key,                 -- e.g. TXN-2026-0046
    member_id       text not null references public.members (member_id),
    type            text not null check (type in ('deposit', 'withdrawal', 'repayment')),
    amount          numeric(14,2) not null check (amount > 0),
    method          text not null check (method in ('M-Pesa', 'Bank', 'Cash')),
    status          text not null check (status in ('completed', 'pending', 'failed')),
    created_at      date not null default current_date
);

create table public.loans (
    loan_id                   text primary key,       -- e.g. LN-0007
    member_id                 text not null references public.members (member_id),
    principal                 numeric(14,2) not null check (principal > 0),
    issued_at                 date not null,
    status                    text not null default 'active' check (status in ('active', 'cleared')),
    term_months               int  not null check (term_months > 0),
    monthly_installment       numeric(14,2) not null,
    installments_due          int  not null default 0,
    installments_paid_on_time int  not null default 0,
    installments_paid         int  not null default 0,
    amount_repaid             numeric(14,2) not null default 0,
    next_due_date             date
);

-- member_id NULL = notification for administrators
create table public.notifications (
    notification_id bigint generated always as identity primary key,
    member_id       text references public.members (member_id),
    category        text not null,
    message         text not null,
    is_read         boolean not null default false,
    created_at      date not null default current_date
);

-- One row per login account (Supabase Auth user).
-- This is where a user's ROLE lives, so the role can't be faked in the browser.
create table public.profiles (
    id          uuid primary key references auth.users (id) on delete cascade,
    role        text not null check (role in ('admin', 'member')),
    full_name   text not null,
    member_id   text unique references public.members (member_id),
    -- every member account must be linked to a member record
    check (role = 'admin' or member_id is not null)
);

-- Used to number new transactions (TXN-YYYY-0046, 0047, ...)
create sequence public.transaction_number_seq;


-- ---------------------------------------------------------------------
-- 2. HELPER FUNCTIONS used by the security policies
--    "security definer" lets them read profiles even though RLS
--    is switched on for that table.
-- ---------------------------------------------------------------------

create function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
    select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create function public.my_member_id()
returns text
language sql stable security definer set search_path = public
as $$
    select member_id from profiles where id = auth.uid();
$$;


-- ---------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
--    Once RLS is enabled, a table returns NOTHING unless a policy allows it.
--    Visitors who are not logged in ("anon") get no policies at all.
-- ---------------------------------------------------------------------

alter table public.members       enable row level security;
alter table public.transactions  enable row level security;
alter table public.loans         enable row level security;
alter table public.notifications enable row level security;
alter table public.profiles      enable row level security;

-- READ rules
create policy "admins see all members, members see themselves"
    on public.members for select to authenticated
    using (public.is_admin() or member_id = public.my_member_id());

create policy "admins see all transactions, members see their own"
    on public.transactions for select to authenticated
    using (public.is_admin() or member_id = public.my_member_id());

create policy "admins see all loans, members see their own"
    on public.loans for select to authenticated
    using (public.is_admin() or member_id = public.my_member_id());

create policy "admins see admin notifications, members see their own"
    on public.notifications for select to authenticated
    using ((public.is_admin() and member_id is null) or member_id = public.my_member_id());

create policy "users see their own profile"
    on public.profiles for select to authenticated
    using (id = auth.uid() or public.is_admin());

-- WRITE rules: only admins may add or edit members (for Member Management later).
-- Transactions, balances and notifications change ONLY through the
-- functions below, never by direct inserts/updates from the browser.
create policy "admins add members"
    on public.members for insert to authenticated
    with check (public.is_admin());

create policy "admins edit members"
    on public.members for update to authenticated
    using (public.is_admin()) with check (public.is_admin());

grant usage on schema public to authenticated;
grant select on public.members, public.transactions, public.loans,
                public.notifications, public.profiles to authenticated;
grant insert, update on public.members to authenticated;


-- ---------------------------------------------------------------------
-- 4. FUNCTIONS THE APP CALLS  (supabase.rpc("..."))
-- ---------------------------------------------------------------------

-- Records a transaction AND updates balances in one step.
-- If any check fails, nothing is saved (it all happens in one DB transaction).
create function public.record_transaction(
    p_member_id text,
    p_type      text,
    p_amount    numeric,
    p_method    text,
    p_status    text,
    p_date      date
)
returns public.transactions
language plpgsql security definer set search_path = public
as $$
declare
    v_member public.members;
    v_txn    public.transactions;
begin
    if not public.is_admin() then
        raise exception 'Only administrators can record transactions.';
    end if;

    -- "for update" locks the member row so two admins can't
    -- withdraw the same money at the same time
    select * into v_member from members where member_id = p_member_id for update;
    if not found then
        raise exception 'Please choose a member.';
    end if;
    if p_type not in ('deposit', 'withdrawal', 'repayment') then
        raise exception 'Please choose a transaction type.';
    end if;
    if p_amount is null or p_amount <= 0 then
        raise exception 'Amount must be greater than zero.';
    end if;
    if p_date is null or p_date > current_date then
        raise exception 'Please choose a valid date.';
    end if;
    if p_type = 'withdrawal' and p_status = 'completed' and p_amount > v_member.savings_balance then
        raise exception '% only has KES % in savings.',
            v_member.full_name, to_char(v_member.savings_balance, 'FM999,999,999,990');
    end if;

    insert into transactions (transaction_id, member_id, type, amount, method, status, created_at)
    values (
        'TXN-' || to_char(p_date, 'YYYY') || '-' || lpad(nextval('transaction_number_seq')::text, 4, '0'),
        p_member_id, p_type, p_amount, p_method, p_status, p_date
    )
    returning * into v_txn;

    -- only COMPLETED transactions change balances
    if p_status = 'completed' then
        if p_type = 'deposit' then
            update members set savings_balance = savings_balance + p_amount where member_id = p_member_id;
        elsif p_type = 'withdrawal' then
            update members set savings_balance = savings_balance - p_amount where member_id = p_member_id;
        elsif p_type = 'repayment' then
            -- a repayment reduces the member's active loan
            update loans
               set amount_repaid = least(principal, amount_repaid + p_amount),
                   status = case when amount_repaid + p_amount >= principal then 'cleared' else status end
             where loan_id = (select loan_id from loans
                               where member_id = p_member_id and status = 'active'
                               order by issued_at limit 1);
        end if;
    end if;

    return v_txn;
end;
$$;

-- Marks the current user's notifications as read
create function public.mark_notifications_read()
returns void
language sql security definer set search_path = public
as $$
    update notifications set is_read = true
     where (public.is_admin() and member_id is null)
        or member_id = public.my_member_id();
$$;

-- only logged-in users may call the functions
revoke execute on function public.record_transaction(text, text, numeric, text, text, date) from public, anon;
revoke execute on function public.mark_notifications_read() from public, anon;
grant  execute on function public.record_transaction(text, text, numeric, text, text, date) to authenticated;
grant  execute on function public.mark_notifications_read() to authenticated;


-- ---------------------------------------------------------------------
-- 5. SAMPLE DATA  (same as the old prototype)
-- ---------------------------------------------------------------------

-- email = "firstname.lastname@example.com"
insert into public.members (member_id, full_name, phone, joined_at, savings_balance, email)
select id, name, phone, joined::date, savings, lower(replace(name, ' ', '.')) || '@example.com'
from (values
    ('SS-0001', 'John Kamau',       '0712345678', '2024-02-12', 245000),
    ('SS-0002', 'Mary Njeri',       '0722418903', '2024-02-20', 182500),
    ('SS-0003', 'Peter Otieno',     '0733902114', '2024-04-03',  96000),
    ('SS-0004', 'Faith Achieng',    '0701556287', '2024-05-15', 312750),
    ('SS-0005', 'David Kiprop',     '0798230451', '2024-06-01', 154200),
    ('SS-0006', 'Esther Wambui',    '0711674320', '2024-07-22',  88400),
    ('SS-0007', 'Samuel Mutua',     '0725119846', '2024-08-09', 205000),
    ('SS-0008', 'Lucy Chebet',      '0740382905', '2024-09-14', 132600),
    ('SS-0009', 'James Mwangi',     '0716507233', '2024-10-02', 410300),
    ('SS-0010', 'Ann Wairimu',      '0729846172', '2024-11-18',  67900),
    ('SS-0011', 'Brian Odhiambo',   '0702931584', '2025-01-10', 119450),
    ('SS-0012', 'Mercy Nyambura',   '0757284609', '2025-02-25', 176000),
    ('SS-0013', 'Joseph Kariuki',   '0714663027', '2025-04-07', 238800),
    ('SS-0014', 'Caroline Akinyi',  '0720195438', '2025-05-19',  94250),
    ('SS-0015', 'Daniel Kipkemboi', '0791472816', '2025-07-03', 143700),
    ('SS-0016', 'Purity Muthoni',   '0708359241', '2025-09-11',  58600),
    ('SS-0017', 'Kevin Omondi',     '0736820517', '2025-12-01', 201150),
    ('SS-0018', 'Jane Wanjiru',     '0719047382', '2026-03-16', 165300),
    ('SS-0019', 'Stephen Ndungu',   '0723768950', '2026-06-29', 287400),
    ('SS-0020', 'Rose Atieno',      '0745613094', '2026-11-10', 109800)
) as v(id, name, phone, joined, savings);

-- transaction_id = TXN-<year>-<n>  (n = the number at the start of each row)
insert into public.transactions (transaction_id, member_id, type, amount, method, status, created_at)
select 'TXN-' || left(d, 4) || '-' || lpad(n::text, 4, '0'), m, t, a, meth, s, d::date
from (values
    ( 1, '2026-09-20', 'SS-0011', 'repayment',   8000, 'M-Pesa', 'completed'),
    ( 2, '2026-10-01', 'SS-0001', 'deposit',    15000, 'M-Pesa', 'completed'),
    ( 3, '2026-10-01', 'SS-0009', 'deposit',    50000, 'Bank',   'completed'),
    ( 4, '2026-10-02', 'SS-0004', 'repayment',  12500, 'M-Pesa', 'completed'),
    ( 5, '2026-10-03', 'SS-0012', 'deposit',     8000, 'M-Pesa', 'completed'),
    ( 6, '2026-10-04', 'SS-0003', 'withdrawal', 10000, 'M-Pesa', 'completed'),
    ( 7, '2026-10-05', 'SS-0011', 'deposit',    10000, 'M-Pesa', 'completed'),
    ( 8, '2026-10-06', 'SS-0017', 'deposit',    20000, 'Bank',   'completed'),
    ( 9, '2026-10-07', 'SS-0006', 'deposit',     5000, 'Cash',   'completed'),
    (10, '2026-10-08', 'SS-0019', 'repayment',  18000, 'Bank',   'completed'),
    (11, '2026-10-09', 'SS-0002', 'deposit',    12000, 'M-Pesa', 'completed'),
    (12, '2026-10-10', 'SS-0014', 'withdrawal',  7500, 'M-Pesa', 'failed'),
    (13, '2026-10-12', 'SS-0007', 'deposit',    25000, 'Bank',   'completed'),
    (14, '2026-10-13', 'SS-0010', 'repayment',   4500, 'M-Pesa', 'completed'),
    (15, '2026-10-14', 'SS-0015', 'deposit',    10000, 'M-Pesa', 'completed'),
    (16, '2026-10-15', 'SS-0005', 'repayment',   9800, 'M-Pesa', 'completed'),
    (17, '2026-10-16', 'SS-0013', 'deposit',    30000, 'Bank',   'completed'),
    (18, '2026-10-17', 'SS-0018', 'withdrawal', 15000, 'Bank',   'completed'),
    (19, '2026-10-19', 'SS-0008', 'deposit',     6500, 'M-Pesa', 'completed'),
    (20, '2026-10-20', 'SS-0011', 'repayment',   8000, 'Cash',   'completed'),
    (21, '2026-10-21', 'SS-0020', 'deposit',     9000, 'M-Pesa', 'completed'),
    (22, '2026-10-22', 'SS-0001', 'repayment',  11000, 'M-Pesa', 'completed'),
    (23, '2026-10-23', 'SS-0016', 'deposit',     3500, 'Cash',   'completed'),
    (24, '2026-10-24', 'SS-0009', 'withdrawal', 40000, 'Bank',   'completed'),
    (25, '2026-10-26', 'SS-0004', 'deposit',    22000, 'M-Pesa', 'completed'),
    (26, '2026-10-27', 'SS-0012', 'repayment',   6400, 'M-Pesa', 'failed'),
    (27, '2026-10-28', 'SS-0003', 'deposit',     7000, 'M-Pesa', 'completed'),
    (28, '2026-10-29', 'SS-0019', 'deposit',    35000, 'Bank',   'completed'),
    (29, '2026-10-30', 'SS-0006', 'repayment',   5200, 'M-Pesa', 'completed'),
    (30, '2026-10-31', 'SS-0017', 'deposit',    18000, 'M-Pesa', 'completed'),
    (31, '2026-11-02', 'SS-0002', 'withdrawal', 20000, 'M-Pesa', 'completed'),
    (32, '2026-11-03', 'SS-0007', 'repayment',  15500, 'Bank',   'completed'),
    (33, '2026-11-04', 'SS-0013', 'deposit',    12000, 'M-Pesa', 'completed'),
    (34, '2026-11-05', 'SS-0010', 'deposit',     4000, 'Cash',   'completed'),
    (35, '2026-11-06', 'SS-0015', 'withdrawal', 12000, 'M-Pesa', 'completed'),
    (36, '2026-11-07', 'SS-0005', 'deposit',    16000, 'M-Pesa', 'completed'),
    (37, '2026-11-08', 'SS-0011', 'deposit',     5000, 'Cash',   'completed'),
    (38, '2026-11-09', 'SS-0014', 'repayment',   8300, 'M-Pesa', 'completed'),
    (39, '2026-11-10', 'SS-0008', 'deposit',     7500, 'M-Pesa', 'completed'),
    (40, '2026-11-11', 'SS-0018', 'deposit',    14000, 'Bank',   'completed'),
    (41, '2026-11-12', 'SS-0011', 'withdrawal',  6000, 'M-Pesa', 'pending'),
    (42, '2026-11-13', 'SS-0020', 'repayment',   9600, 'M-Pesa', 'completed'),
    (43, '2026-11-13', 'SS-0001', 'deposit',    20000, 'M-Pesa', 'completed'),
    (44, '2026-11-14', 'SS-0016', 'deposit',     5000, 'M-Pesa', 'pending'),
    (45, '2026-11-15', 'SS-0009', 'repayment',  25000, 'Bank',   'pending')
) as v(n, d, m, t, a, meth, s);

-- new transactions continue after the 45 sample ones
select setval('public.transaction_number_seq', (select count(*) from public.transactions));

-- monthly_installment = principal / term (rounded up), no interest yet
insert into public.loans (loan_id, member_id, principal, issued_at, term_months,
                          installments_due, installments_paid_on_time, installments_paid,
                          next_due_date, monthly_installment, amount_repaid)
select id, m, p, issued::date, term, due, on_time, paid, next_due::date,
       ceil(p::numeric / term), least(p, ceil(p::numeric / term) * paid)
from (values
    ('LN-0001', 'SS-0001', 120000, '2025-12-05', 12, 10, 10, 10, '2026-12-05'),
    ('LN-0002', 'SS-0004', 150000, '2025-10-14', 18, 12, 12, 12, '2026-11-24'),
    ('LN-0003', 'SS-0005', 100000, '2026-03-02', 12,  8,  7,  8, '2026-12-02'),
    ('LN-0004', 'SS-0006',  50000, '2026-05-11', 10,  6,  6,  6, '2026-12-11'),
    ('LN-0005', 'SS-0007', 180000, '2026-02-17', 18,  9,  9,  9, '2026-12-17'),
    ('LN-0006', 'SS-0010',  45000, '2026-04-08',  9,  7,  6,  6, '2026-11-08'),
    ('LN-0007', 'SS-0011',  80000, '2026-03-20', 10,  8,  8,  8, '2026-11-20'),
    ('LN-0008', 'SS-0012',  60000, '2026-06-01', 12,  5,  5,  5, '2026-12-01'),
    ('LN-0009', 'SS-0014',  90000, '2026-02-03', 12,  9,  8,  9, '2026-12-03'),
    ('LN-0010', 'SS-0019', 200000, '2026-01-12', 24, 10, 10, 10, '2026-12-12'),
    ('LN-0011', 'SS-0020',  95000, '2026-03-09', 12,  8,  8,  8, '2026-12-09'),
    ('LN-0012', 'SS-0009', 250000, '2026-03-25', 24,  8,  8,  8, '2026-11-25')
) as v(id, m, p, issued, term, due, on_time, paid, next_due);

insert into public.notifications (member_id, category, is_read, created_at, message) values
    (null,      'loan',        false, '2026-11-15', 'New loan application from Kevin Omondi (KES 150,000)'),
    (null,      'overdue',     false, '2026-11-14', 'Ann Wairimu''s loan repayment is 5 days overdue'),
    (null,      'transaction', false, '2026-11-12', 'Withdrawal of KES 6,000 by Brian Odhiambo is pending'),
    (null,      'member',      true,  '2026-11-10', 'New member registered: Rose Atieno'),
    (null,      'report',      true,  '2026-11-01', 'October financial report is ready'),
    ('SS-0011', 'loan',        false, '2026-11-15', 'Your loan instalment of KES 8,000 is due on 20/11/2026'),
    ('SS-0011', 'transaction', false, '2026-11-12', 'Your withdrawal of KES 6,000 is pending approval'),
    ('SS-0011', 'transaction', true,  '2026-11-08', 'Deposit of KES 5,000 received into your savings'),
    ('SS-0010', 'overdue',     false, '2026-11-14', 'Your loan instalment of KES 5,000 is overdue');
