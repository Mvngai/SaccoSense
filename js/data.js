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

    /**
     * Checks and tidies the member form before it is sent to the database.
     * The database checks again (uniqueness, trigger in member-management.sql),
     * but checking here gives the admin instant, readable messages.
     * Returns a clean object containing only the columns the admin may write.
     */
    function cleanMemberInput(input) {
        const fullName = String(input.full_name || "").trim().replace(/\s+/g, " ");
        const nationalId = String(input.national_id || "").trim();
        const email = String(input.email || "").trim().toLowerCase();
        const address = String(input.address || "").trim();
        const dateOfBirth = input.date_of_birth || "";

        // Phone: accept "0712 345 678", "+254712345678" or "254712345678",
        // and always store the 10-digit form "0712345678"
        let phone = String(input.phone || "").replace(/[\s-]/g, "");
        if (/^\+?254\d{9}$/.test(phone)) phone = "0" + phone.slice(-9);

        if (fullName.split(" ").length < 2) throw new Error("Please enter the member's full name (at least two names).");
        if (!/^[A-Za-z0-9]{5,15}$/.test(nationalId)) throw new Error("National ID should be 5–15 letters or numbers, with no spaces.");
        if (!/^0[17]\d{8}$/.test(phone)) throw new Error("Please enter a valid Kenyan phone number, e.g. 0712 345 678.");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Please enter a valid email address.");
        if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) throw new Error("Please choose a valid date of birth.");

        return {
            full_name: fullName,
            national_id: nationalId,
            phone: phone,
            email: email,
            date_of_birth: dateOfBirth || null,   // optional: empty -> NULL
            address: address || null              // optional: empty -> NULL
        };
    }

    // Turns database errors about duplicates into plain English
    function memberError(error) {
        const message = error.message || "";
        if (message.indexOf("members_email_key") !== -1) return new Error("Another member already uses this email address.");
        if (message.indexOf("members_national_id_key") !== -1) return new Error("Another member already has this national ID number.");
        return new Error(message);
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

    //loadCurrentUser() checks for a session, then reads that user's profile to get the role.
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

        /**
         * Registers a new member and returns the saved record.
         * We do NOT send a member_id: the database generates it (SS-0021, ...),
         * and the savings balance starts at 0. (See member-management.sql.)
         */
        addMember: async function (input) {
            const member = cleanMemberInput(input);
            const result = await db.from("members").insert(member).select().single();
            if (result.error) throw memberError(result.error);
            return result.data;
        },

        // Saves changes to a member's personal details
        updateMember: async function (memberId, input) {
            const changes = cleanMemberInput(input);
            const result = await db.from("members").update(changes)
                .eq("member_id", memberId).select().single();
            if (result.error) throw memberError(result.error);
            return result.data;
        },

        // Activate / deactivate a member ("active" or "inactive")
        setMemberStatus: async function (memberId, status) {
            return check(await db.from("members").update({ status: status })
                .eq("member_id", memberId).select().single());
        },

        /**
         * Everything the member profile page needs, in one call:
         * the member record, a short financial overview, and whether
         * they have activated a login account yet.
         * Returns null if no member has that ID.
         */
        getMemberProfile: async function (memberId) {
            // the four queries run at the same time (Promise.all)
            const results = await Promise.all([
                db.from("members").select("*").eq("member_id", memberId).maybeSingle(),
                db.from("loans").select("*").eq("member_id", memberId).eq("status", "active")
                    .order("issued_at").limit(1).maybeSingle(),
                db.from("transactions").select("*").eq("member_id", memberId)
                    .order("created_at", { ascending: false }).limit(1).maybeSingle(),
                db.from("profiles").select("id").eq("member_id", memberId).maybeSingle()
            ]);

            const member = check(results[0]);
            if (!member) return null;

            const loan = check(results[1]);
            return {
                member: member,
                loan: loan ? summariseLoan(loan) : null,
                last_transaction: check(results[2]),
                has_login: Boolean(check(results[3]))
            };
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
