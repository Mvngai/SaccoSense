/* =====================================================================
   SaccoSense DATA LAYER  (js/data.js)

   This is the ONLY file that knows where the data lives.
   Every page asks for data through the functions in `SaccoData`
   (getMembers, addTransaction, ...) and never touches storage directly.

   TODAY:  the data is sample data saved in the browser (localStorage),
           so your changes survive a page refresh.
   LATER:  replace the bodies of these functions with Supabase queries
           (e.g. supabase.from("transactions").select("*")). The pages
           will keep working because the function names stay the same.

   Field names use snake_case so they match PostgreSQL columns and
   Django model fields. Each record below is the same shape as a row
   in the matching table: members, transactions, loans, notifications.

   ACCESS: members can only reach their own data through getMyAccount()
   and getNotifications(). This is a prototype check in the browser; real
   protection will come from Supabase Auth + Row Level Security.

   All functions are `async` (they return Promises) because real
   database calls are asynchronous. The pages already use `await`.
   ===================================================================== */

(function () {
    "use strict";

    // v2: loans gained repayment fields and notifications gained member_id.
    // Changing the key makes browsers load the new sample data instead of
    // an old saved copy that is missing those fields.
    const STORAGE_KEY = "saccosense_db_v2";
    const SESSION_KEY = "saccosense_session";


    /* ---------------------------------------------------------------
       SAMPLE DATA (the original set that "Reset sample data" restores)
       --------------------------------------------------------------- */

    // members table
    const SEED_MEMBERS = [
        ["SS-0001", "John Kamau",       "0712345678", "2024-02-12", 245000],
        ["SS-0002", "Mary Njeri",       "0722418903", "2024-02-20", 182500],
        ["SS-0003", "Peter Otieno",     "0733902114", "2024-04-03",  96000],
        ["SS-0004", "Faith Achieng",    "0701556287", "2024-05-15", 312750],
        ["SS-0005", "David Kiprop",     "0798230451", "2024-06-01", 154200],
        ["SS-0006", "Esther Wambui",    "0711674320", "2024-07-22",  88400],
        ["SS-0007", "Samuel Mutua",     "0725119846", "2024-08-09", 205000],
        ["SS-0008", "Lucy Chebet",      "0740382905", "2024-09-14", 132600],
        ["SS-0009", "James Mwangi",     "0716507233", "2024-10-02", 410300],
        ["SS-0010", "Ann Wairimu",      "0729846172", "2024-11-18",  67900],
        ["SS-0011", "Brian Odhiambo",   "0702931584", "2025-01-10", 119450],
        ["SS-0012", "Mercy Nyambura",   "0757284609", "2025-02-25", 176000],
        ["SS-0013", "Joseph Kariuki",   "0714663027", "2025-04-07", 238800],
        ["SS-0014", "Caroline Akinyi",  "0720195438", "2025-05-19",  94250],
        ["SS-0015", "Daniel Kipkemboi", "0791472816", "2025-07-03", 143700],
        ["SS-0016", "Purity Muthoni",   "0708359241", "2025-09-11",  58600],
        ["SS-0017", "Kevin Omondi",     "0736820517", "2025-12-01", 201150],
        ["SS-0018", "Jane Wanjiru",     "0719047382", "2026-03-16", 165300],
        ["SS-0019", "Stephen Ndungu",   "0723768950", "2026-06-29", 287400],
        ["SS-0020", "Rose Atieno",      "0745613094", "2026-11-10", 109800]
    ].map(function (row) {
        const name = row[1];
        return {
            member_id: row[0],
            full_name: name,
            phone: row[2],
            email: name.toLowerCase().replace(" ", ".") + "@example.com",
            joined_at: row[3],
            status: "active",
            savings_balance: row[4]
        };
    });

    // transactions table: [date, member_id, type, amount, method, status]
    const SEED_TRANSACTIONS = [
        ["2026-09-20", "SS-0011", "repayment",   8000, "M-Pesa", "completed"],
        ["2026-10-01", "SS-0001", "deposit",    15000, "M-Pesa", "completed"],
        ["2026-10-01", "SS-0009", "deposit",    50000, "Bank",   "completed"],
        ["2026-10-02", "SS-0004", "repayment",  12500, "M-Pesa", "completed"],
        ["2026-10-03", "SS-0012", "deposit",     8000, "M-Pesa", "completed"],
        ["2026-10-04", "SS-0003", "withdrawal", 10000, "M-Pesa", "completed"],
        ["2026-10-05", "SS-0011", "deposit",    10000, "M-Pesa", "completed"],
        ["2026-10-06", "SS-0017", "deposit",    20000, "Bank",   "completed"],
        ["2026-10-07", "SS-0006", "deposit",     5000, "Cash",   "completed"],
        ["2026-10-08", "SS-0019", "repayment",  18000, "Bank",   "completed"],
        ["2026-10-09", "SS-0002", "deposit",    12000, "M-Pesa", "completed"],
        ["2026-10-10", "SS-0014", "withdrawal",  7500, "M-Pesa", "failed"],
        ["2026-10-12", "SS-0007", "deposit",    25000, "Bank",   "completed"],
        ["2026-10-13", "SS-0010", "repayment",   4500, "M-Pesa", "completed"],
        ["2026-10-14", "SS-0015", "deposit",    10000, "M-Pesa", "completed"],
        ["2026-10-15", "SS-0005", "repayment",   9800, "M-Pesa", "completed"],
        ["2026-10-16", "SS-0013", "deposit",    30000, "Bank",   "completed"],
        ["2026-10-17", "SS-0018", "withdrawal", 15000, "Bank",   "completed"],
        ["2026-10-19", "SS-0008", "deposit",     6500, "M-Pesa", "completed"],
        ["2026-10-20", "SS-0011", "repayment",   8000, "Cash",   "completed"],
        ["2026-10-21", "SS-0020", "deposit",     9000, "M-Pesa", "completed"],
        ["2026-10-22", "SS-0001", "repayment",  11000, "M-Pesa", "completed"],
        ["2026-10-23", "SS-0016", "deposit",     3500, "Cash",   "completed"],
        ["2026-10-24", "SS-0009", "withdrawal", 40000, "Bank",   "completed"],
        ["2026-10-26", "SS-0004", "deposit",    22000, "M-Pesa", "completed"],
        ["2026-10-27", "SS-0012", "repayment",   6400, "M-Pesa", "failed"],
        ["2026-10-28", "SS-0003", "deposit",     7000, "M-Pesa", "completed"],
        ["2026-10-29", "SS-0019", "deposit",    35000, "Bank",   "completed"],
        ["2026-10-30", "SS-0006", "repayment",   5200, "M-Pesa", "completed"],
        ["2026-10-31", "SS-0017", "deposit",    18000, "M-Pesa", "completed"],
        ["2026-11-02", "SS-0002", "withdrawal", 20000, "M-Pesa", "completed"],
        ["2026-11-03", "SS-0007", "repayment",  15500, "Bank",   "completed"],
        ["2026-11-04", "SS-0013", "deposit",    12000, "M-Pesa", "completed"],
        ["2026-11-05", "SS-0010", "deposit",     4000, "Cash",   "completed"],
        ["2026-11-06", "SS-0015", "withdrawal", 12000, "M-Pesa", "completed"],
        ["2026-11-07", "SS-0005", "deposit",    16000, "M-Pesa", "completed"],
        ["2026-11-08", "SS-0011", "deposit",     5000, "Cash",   "completed"],
        ["2026-11-09", "SS-0014", "repayment",   8300, "M-Pesa", "completed"],
        ["2026-11-10", "SS-0008", "deposit",     7500, "M-Pesa", "completed"],
        ["2026-11-11", "SS-0018", "deposit",    14000, "Bank",   "completed"],
        ["2026-11-12", "SS-0011", "withdrawal",  6000, "M-Pesa", "pending"],
        ["2026-11-13", "SS-0020", "repayment",   9600, "M-Pesa", "completed"],
        ["2026-11-13", "SS-0001", "deposit",    20000, "M-Pesa", "completed"],
        ["2026-11-14", "SS-0016", "deposit",     5000, "M-Pesa", "pending"],
        ["2026-11-15", "SS-0009", "repayment",  25000, "Bank",   "pending"]
    ].map(function (row, index) {
        return {
            transaction_id: makeTransactionId(row[0], index + 1),
            member_id: row[1],
            type: row[2],
            amount: row[3],
            method: row[4],
            status: row[5],
            created_at: row[0]
        };
    });

    // loans table
    // [loan_id, member_id, principal, issued_at, term_months,
    //  installments_due, installments_paid_on_time, installments_paid, next_due_date]
    //
    // installments_due / installments_paid_on_time feed the admin repayment rate.
    // term_months / installments_paid / next_due_date feed the member dashboard.
    // Interest is not included yet (it will be added in Loan Management), so
    // monthly_installment = principal / term_months, rounded up.
    // Later this will come from a proper repayment schedule table.
    const SEED_LOANS = [
        ["LN-0001", "SS-0001", 120000, "2025-12-05", 12, 10, 10, 10, "2026-12-05"],
        ["LN-0002", "SS-0004", 150000, "2025-10-14", 18, 12, 12, 12, "2026-11-24"],
        ["LN-0003", "SS-0005", 100000, "2026-03-02", 12,  8,  7,  8, "2026-12-02"],
        ["LN-0004", "SS-0006",  50000, "2026-05-11", 10,  6,  6,  6, "2026-12-11"],
        ["LN-0005", "SS-0007", 180000, "2026-02-17", 18,  9,  9,  9, "2026-12-17"],
        ["LN-0006", "SS-0010",  45000, "2026-04-08",  9,  7,  6,  6, "2026-11-08"],
        ["LN-0007", "SS-0011",  80000, "2026-03-20", 10,  8,  8,  8, "2026-11-20"],
        ["LN-0008", "SS-0012",  60000, "2026-06-01", 12,  5,  5,  5, "2026-12-01"],
        ["LN-0009", "SS-0014",  90000, "2026-02-03", 12,  9,  8,  9, "2026-12-03"],
        ["LN-0010", "SS-0019", 200000, "2026-01-12", 24, 10, 10, 10, "2026-12-12"],
        ["LN-0011", "SS-0020",  95000, "2026-03-09", 12,  8,  8,  8, "2026-12-09"],
        ["LN-0012", "SS-0009", 250000, "2026-03-25", 24,  8,  8,  8, "2026-11-25"]
    ].map(function (row) {
        const principal = row[2];
        const term = row[4];
        const monthly = Math.ceil(principal / term);
        const paid = row[7];
        return {
            loan_id: row[0],
            member_id: row[1],
            principal: principal,
            issued_at: row[3],
            status: "active",
            term_months: term,
            monthly_installment: monthly,
            installments_due: row[5],
            installments_paid_on_time: row[6],
            installments_paid: paid,
            amount_repaid: Math.min(principal, monthly * paid),
            next_due_date: row[8]
        };
    });

    // notifications table
    // member_id: null      -> for administrators
    // member_id: "SS-0011" -> only for that member
    const SEED_NOTIFICATIONS = [
        { notification_id: 1, member_id: null, category: "loan",        is_read: false, created_at: "2026-11-15",
          message: "New loan application from Kevin Omondi (KES 150,000)" },
        { notification_id: 2, member_id: null, category: "overdue",     is_read: false, created_at: "2026-11-14",
          message: "Ann Wairimu's loan repayment is 5 days overdue" },
        { notification_id: 3, member_id: null, category: "transaction", is_read: false, created_at: "2026-11-12",
          message: "Withdrawal of KES 6,000 by Brian Odhiambo is pending" },
        { notification_id: 4, member_id: null, category: "member",      is_read: true,  created_at: "2026-11-10",
          message: "New member registered: Rose Atieno" },
        { notification_id: 5, member_id: null, category: "report",      is_read: true,  created_at: "2026-11-01",
          message: "October financial report is ready" },

        // member notifications
        { notification_id: 6, member_id: "SS-0011", category: "loan",        is_read: false, created_at: "2026-11-15",
          message: "Your loan instalment of KES 8,000 is due on 20/11/2026" },
        { notification_id: 7, member_id: "SS-0011", category: "transaction", is_read: false, created_at: "2026-11-12",
          message: "Your withdrawal of KES 6,000 is pending approval" },
        { notification_id: 8, member_id: "SS-0011", category: "transaction", is_read: true,  created_at: "2026-11-08",
          message: "Deposit of KES 5,000 received into your savings" },
        { notification_id: 9, member_id: "SS-0010", category: "overdue",     is_read: false, created_at: "2026-11-14",
          message: "Your loan instalment of KES 5,000 is overdue" }
    ];

    // The logged-in admin (Supabase Auth will provide this later)
    const SAMPLE_ADMIN = { full_name: "Grace Wanjiku", role: "admin" };


    /* ---------------------------------------------------------------
       STORAGE HELPERS (localStorage for now)
       --------------------------------------------------------------- */

    function makeTransactionId(dateString, number) {
        return "TXN-" + dateString.slice(0, 4) + "-" + String(number).padStart(4, "0");
    }

    function freshCopyOfSeed() {
        return JSON.parse(JSON.stringify({
            members: SEED_MEMBERS,
            transactions: SEED_TRANSACTIONS,
            loans: SEED_LOANS,
            notifications: SEED_NOTIFICATIONS
        }));
    }

    // If the browser blocks storage (e.g. some private windows),
    // the app still works; changes just won't survive a refresh.
    let memoryDb = null;

    function loadDb() {
        if (memoryDb) return memoryDb;
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            memoryDb = saved ? JSON.parse(saved) : freshCopyOfSeed();
        } catch (error) {
            memoryDb = freshCopyOfSeed();
        }
        return memoryDb;
    }

    function saveDb() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryDb));
        } catch (error) {
            /* storage unavailable: keep working in memory */
        }
    }

    function copy(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function findMemberByEmail(email) {
        const wanted = String(email || "").trim().toLowerCase();
        return loadDb().members.find(function (m) {
            return m.email.toLowerCase() === wanted;
        }) || null;
    }

    // Adds the figures the member dashboard shows to a loan record
    function summariseLoan(loan) {
        const outstanding = Math.max(0, loan.principal - loan.amount_repaid);
        const summary = copy(loan);
        summary.outstanding_balance = outstanding;
        summary.repaid_percent = Math.round((loan.amount_repaid / loan.principal) * 1000) / 10;
        // the last instalment may be smaller than the usual monthly amount
        summary.next_installment_amount = Math.min(loan.monthly_installment, outstanding);
        return summary;
    }


    /* ---------------------------------------------------------------
       CURRENT USER (temporary: read from the browser session)
       --------------------------------------------------------------- */

    function readCurrentUser() {
        let session = null;
        try {
            session = JSON.parse(
                sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || "null"
            );
        } catch (error) {
            session = null;
        }
        if (!session) return null;

        if (session.role === "admin") {
            return { full_name: SAMPLE_ADMIN.full_name, role: "admin", email: session.email };
        }

        // a member session is only valid if the email belongs to a member
        if (session.role === "member") {
            const member = findMemberByEmail(session.email);
            if (!member) return null;
            return {
                full_name: member.full_name,
                role: "member",
                email: member.email,
                member_id: member.member_id
            };
        }
        return null;
    }

    function notificationsForCurrentUser() {
        const user = readCurrentUser();
        if (!user) return [];
        return loadDb().notifications.filter(function (n) {
            return user.role === "admin" ? !n.member_id : n.member_id === user.member_id;
        });
    }


    /* ---------------------------------------------------------------
       PUBLIC API: what the pages use
       --------------------------------------------------------------- */

    window.SaccoData = {

        /* ----- Members ----- */

        getMembers: async function () {
            return copy(loadDb().members);
        },

        getMember: async function (memberId) {
            const member = loadDb().members.find(function (m) { return m.member_id === memberId; });
            return member ? copy(member) : null;
        },


        /* ----- Transactions ----- */

        getTransactions: async function () {
            return copy(loadDb().transactions);
        },

        /**
         * Records a transaction and updates the member's savings balance.
         * Only COMPLETED deposits/withdrawals change balances.
         * Repayments go towards loans, not savings.
         * Throws an Error with a readable message if the input is invalid.
         */
        addTransaction: async function (input) {
            const db = loadDb();
            const member = db.members.find(function (m) { return m.member_id === input.member_id; });
            const amount = Number(input.amount);

            if (!member) throw new Error("Please choose a member.");
            if (["deposit", "withdrawal", "repayment"].indexOf(input.type) === -1) {
                throw new Error("Please choose a transaction type.");
            }
            if (!Number.isFinite(amount) || amount <= 0) {
                throw new Error("Amount must be greater than zero.");
            }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(input.created_at || "")) {
                throw new Error("Please choose a valid date.");
            }
            if (input.type === "withdrawal" && input.status === "completed" && amount > member.savings_balance) {
                throw new Error(
                    member.full_name + " only has KES " +
                    member.savings_balance.toLocaleString("en-KE") + " in savings."
                );
            }

            // next number = highest existing number + 1
            const highest = db.transactions.reduce(function (max, t) {
                return Math.max(max, Number(t.transaction_id.split("-")[2]) || 0);
            }, 0);

            const transaction = {
                transaction_id: makeTransactionId(input.created_at, highest + 1),
                member_id: member.member_id,
                type: input.type,
                amount: amount,
                method: input.method,
                status: input.status,
                created_at: input.created_at
            };

            if (transaction.status === "completed") {
                if (transaction.type === "deposit") member.savings_balance += amount;
                if (transaction.type === "withdrawal") member.savings_balance -= amount;

                // a completed repayment reduces the member's active loan
                if (transaction.type === "repayment") {
                    const loan = db.loans.find(function (l) {
                        return l.member_id === member.member_id && l.status === "active";
                    });
                    if (loan) {
                        loan.amount_repaid = Math.min(loan.principal, loan.amount_repaid + amount);
                        if (loan.amount_repaid >= loan.principal) loan.status = "cleared";
                    }
                }
            }

            db.transactions.push(transaction);
            saveDb();
            return copy(transaction);
        },


        /* ----- Loans ----- */

        getLoans: async function () {
            return copy(loadDb().loans);
        },


        /* ----- Dashboard statistics ----- */

        getStats: async function () {
            const db = loadDb();
            const totalSavings = db.members.reduce(function (sum, m) { return sum + m.savings_balance; }, 0);
            const due = db.loans.reduce(function (sum, l) { return sum + l.installments_due; }, 0);
            const paid = db.loans.reduce(function (sum, l) { return sum + l.installments_paid_on_time; }, 0);

            return {
                total_members: db.members.length,
                active_members: db.members.filter(function (m) { return m.status === "active"; }).length,
                total_savings: totalSavings,
                repayment_rate: due ? Math.round((paid / due) * 1000) / 10 : 0,
                installments_due: due,
                installments_paid_on_time: paid
            };
        },


        /* ----- Member's own account (member dashboard) ----- */

        /**
         * Returns ONLY the logged-in member's data: their member record,
         * their active loan (or null) and their own transactions.
         * There is deliberately no way to pass in another member's ID.
         * Once Supabase is connected, Row Level Security (RLS) will enforce
         * this on the server too.
         */
        getMyAccount: async function () {
            const user = readCurrentUser();
            if (!user || user.role !== "member") throw new Error("Only members can view this account.");

            const db = loadDb();
            const member = db.members.find(function (m) { return m.member_id === user.member_id; });
            const loan = db.loans.find(function (l) {
                return l.member_id === user.member_id && l.status === "active";
            });
            const transactions = db.transactions.filter(function (t) {
                return t.member_id === user.member_id;
            });

            return {
                member: copy(member),
                loan: loan ? summariseLoan(loan) : null,
                transactions: copy(transactions)
            };
        },


        /* ----- Notifications ----- */

        // Admins see admin notifications; a member sees only their own.
        getNotifications: async function () {
            return copy(notificationsForCurrentUser());
        },

        markAllNotificationsRead: async function () {
            notificationsForCurrentUser().forEach(function (n) { n.is_read = true; });
            saveDb();
        },


        /* ----- Session (Supabase Auth will replace this) ----- */

        getCurrentUser: function () {
            return readCurrentUser();
        },

        // used by the login page to check a member's email exists
        findMemberByEmail: async function (email) {
            const member = findMemberByEmail(email);
            return member ? copy(member) : null;
        },

        signOut: function () {
            try {
                sessionStorage.removeItem(SESSION_KEY);
                localStorage.removeItem(SESSION_KEY);
            } catch (error) { /* ignore */ }
        },


        /* ----- Testing only: remove once Supabase is connected ----- */

        resetData: async function () {
            memoryDb = freshCopyOfSeed();
            saveDb();
        }
    };
})();
