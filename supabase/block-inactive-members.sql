-- =====================================================================
-- SaccoSense: BLOCK TRANSACTIONS FOR INACTIVE MEMBERS
--
-- Run ONCE in the Supabase SQL Editor, AFTER member-management.sql.
--
-- Replaces record_transaction() (from schema.sql) with the same function
-- plus ONE new check: the member must be active. Everything else is
-- unchanged. "create or replace" keeps the existing permissions
-- (only logged-in users may call it).
-- =====================================================================

create or replace function public.record_transaction(
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

    -- NEW: deactivated members can't have new transactions
    if v_member.status <> 'active' then
        raise exception '% is inactive. Reactivate them on their profile before recording a transaction.',
            v_member.full_name;
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
