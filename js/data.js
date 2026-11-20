/* =====================================================================
   SaccoSense DATA LAYER  (js/data.js)

   This is the ONLY file that knows where the data lives.
   Every page asks for data through the functions in `SaccoData`
   (getMembers, addTransaction, ...) and never talks to the database directly.

   The data now lives in SUPABASE (PostgreSQL in the cloud).
   - Logging in uses Supabase Auth (email + password).
   - The user's role (admin / member) comes from the `profiles` table.
   - Row Level Security (RLS) on the database decides which rows each
     user may read. So even if someone edits this JavaScript in their
     browser, a member still can't download other members' data.
     (See supabase/schema.sql.)

   Load order on a page:
     supabase-js (CDN) -> supabase-config.js -> data.js -> app.js -> page script
   ===================================================================== */

(function () {
    "use strict";

    // "Remember me" choice: "true" = stay logged in after closing the browser
    const REMEMBER_KEY = "saccosense_remember";


    /* ---------------------------------------------------------------
       CONNECT TO SUPABASE
       --------------------------------------------------------------- */

    // Supabase saves the login session in the browser. This small object
    // decides WHERE: localStorage (kept after closing the browser) if
    // "Remember me" was ticked, otherwise sessionStorage (this tab only).
    function pickStorage() {
        try {
            return localStorage.getItem(REMEMBER_KEY) === "false" ? sessionStorage : localStorage;
        } catch (error) {
            return sessionStorage;
        }
    }

    const authStorage = {
        getItem: function (key) {
            try { return pickStorage().getItem(key); } catch (error) { return null; }
        },
        setItem: function (key, value) {
            try { pickStorage().setItem(key, value); } catch (error) { /* ignore */ }
        },
        removeItem: function (key) {
            try {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
            } catch (error) { /* ignore */ }
        }
    };

    // window.supabase comes from the supabase-js <script> tag,
    // window.SACCO_SUPABASE from js/supabase-config.js
    const db = window.supabase.createClient(
        window.SACCO_SUPABASE.url,
        window.SACCO_SUPABASE.anonKey,
        { auth: { storage: authStorage, persistSession: true, autoRefreshToken: true } }
    );


    /* ---------------------------------------------------------------
       HELPERS
       --------------------------------------------------------------- */

    // Supabase returns { data, error }. This turns an error into a
    // normal JavaScript Error so pages can use try/catch.
    function check(result) {
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }

    // Adds the figures the member dashboard shows to a loan record
    function summariseLoan(loan) {
        const outstanding = Math.max(0, loan.principal - loan.amount_repaid);
        const summary = Object.assign({}, loan);
        summary.outstanding_balance = outstanding;
        summary.repaid_percent = Math.round((loan.amount_repaid / loan.principal) * 1000) / 10;
        // the last instalment may be smaller than the usual monthly amount
        summary.next_installment_amount = Math.min(loan.monthly_installment, outstanding);
        return summary;
    }


    /* ---------------------------------------------------------------
       CURRENT USER
       `ready` is a Promise that finishes once we know who is logged in.
       app.js and the page scripts wait for it before doing anything.
       --------------------------------------------------------------- */

    let currentUser = null;

    async function loadCurrentUser() {
        currentUser = null;

        // 1. Is there a logged-in Supabase session?
        const sessionResult = await db.auth.getSession();
        const session = sessionResult.data.session;
        if (!session) return null;

        // 2. Look up their role. RLS only lets them read their own profile.
        const profile = check(
            await db.from("profiles")
                .select("role, full_name, member_id")
                .eq("id", session.user.id)
                .maybeSingle()
        );
        if (!profile) return null;   // logged in, but no role assigned yet

        currentUser = {
            role: profile.role,
            full_name: profile.full_name,
            member_id: profile.member_id,
            email: session.user.email
        };
        return currentUser;
    }

    const ready = loadCurrentUser().catch(function (error) {
        console.error("Could not load the current user:", error);
        return null;
    });


    /* ---------------------------------------------------------------
       PUBLIC API: what the pages use
       --------------------------------------------------------------- */

    window.SaccoData = {

        ready: ready,

        /* ----- Members ----- */

        getMembers: async function () {
            return check(await db.from("members").select("*").order("member_id"));
        },

        getMember: async function (memberId) {
            return check(await db.from("members").select("*").eq("member_id", memberId).maybeSingle());
        },


        /* ----- Transactions ----- */

        getTransactions: async function () {
            return check(await db.from("transactions").select("*").order("created_at"));
        },

        /**
         * Records a transaction. The database function record_transaction()
         * (supabase/schema.sql) checks the input, saves the transaction and
         * updates the savings balance / loan in ONE step on the server.
         * Throws an Error with a readable message if something is wrong.
         */
        addTransaction: async function (input) {
            const amount = Number(input.amount);

            // quick checks in the browser (the database checks again)
            if (!input.member_id) throw new Error("Please choose a member.");
            if (!Number.isFinite(amount) || amount <= 0) {
                throw new Error("Amount must be greater than zero.");
            }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(input.created_at || "")) {
                throw new Error("Please choose a valid date.");
            }

            return check(await db.rpc("record_transaction", {
                p_member_id: input.member_id,
                p_type: input.type,
                p_amount: amount,
                p_method: input.method,
                p_status: input.status,
                p_date: input.created_at
            }));
        },


        /* ----- Loans ----- */

        getLoans: async function () {
            return check(await db.from("loans").select("*").order("loan_id"));
        },


        /* ----- Dashboard statistics ----- */

        getStats: async function () {
            const results = await Promise.all([this.getMembers(), this.getLoans()]);
            const members = results[0];
            const loans = results[1];

            const totalSavings = members.reduce(function (sum, m) { return sum + Number(m.savings_balance); }, 0);
            const due = loans.reduce(function (sum, l) { return sum + l.installments_due; }, 0);
            const paid = loans.reduce(function (sum, l) { return sum + l.installments_paid_on_time; }, 0);

            return {
                total_members: members.length,
                active_members: members.filter(function (m) { return m.status === "active"; }).length,
                total_savings: totalSavings,
                repayment_rate: due ? Math.round((paid / due) * 1000) / 10 : 0,
                installments_due: due,
                installments_paid_on_time: paid
            };
        },


        /* ----- Member's own account (member dashboard) ----- */

        /**
         * Returns ONLY the logged-in member's data. The filters below make
         * the queries tidy, but RLS on the database is what actually stops a
         * member from reading anyone else's rows.
         */
        getMyAccount: async function () {
            const user = currentUser;
            if (!user || user.role !== "member") throw new Error("Only members can view this account.");

            const results = await Promise.all([
                db.from("members").select("*").eq("member_id", user.member_id).single(),
                db.from("loans").select("*").eq("member_id", user.member_id).eq("status", "active")
                    .order("issued_at").limit(1).maybeSingle(),
                db.from("transactions").select("*").eq("member_id", user.member_id).order("created_at")
            ]);

            const loan = check(results[1]);
            return {
                member: check(results[0]),
                loan: loan ? summariseLoan(loan) : null,
                transactions: check(results[2])
            };
        },


        /* ----- Notifications ----- */

        // RLS returns admin notifications to admins and a member's own to members
        getNotifications: async function () {
            return check(await db.from("notifications").select("*").order("created_at", { ascending: false }));
        },

        markAllNotificationsRead: async function () {
            check(await db.rpc("mark_notifications_read"));
        },


        /* ----- Session (Supabase Auth) ----- */

        // Only valid after `SaccoData.ready` has finished
        getCurrentUser: function () {
            return currentUser;
        },

        /**
         * Logs in with Supabase Auth and returns the user (with role).
         * remember = true keeps the user logged in after the browser closes.
         */
        signIn: async function (email, password, remember) {
            try { localStorage.setItem(REMEMBER_KEY, remember ? "true" : "false"); } catch (error) { /* ignore */ }

            const result = await db.auth.signInWithPassword({ email: email, password: password });
            if (result.error) throw new Error("Incorrect email or password.");

            const user = await loadCurrentUser();
            if (!user) {
                await db.auth.signOut();
                throw new Error("This account has not been given access yet. Contact your SACCO administrator.");
            }
            return user;
        },

        signOut: async function () {
            currentUser = null;
            await db.auth.signOut();
        }
    };
})();
