/* =====================================================================
   SaccoSense MEMBER DASHBOARD  (js/member-dashboard.js)
   - statistic cards: savings, outstanding loan, next repayment
   - "My Recent Activity" table: filter tabs, search, 5 rows per page,
     read-only details pop-up
   Everything comes from SaccoData.getMyAccount(), which only ever
   returns the logged-in member's own data.
   ===================================================================== */

// wait until data.js knows who is logged in (see SaccoData.ready)
SaccoData.ready.then(function () {
    "use strict";

    // app.js is already redirecting to the login page
    const currentUser = SaccoData.getCurrentUser();
    if (!currentUser || currentUser.role !== "member") return;

    const ui = window.SaccoUI;
    const PAGE_SIZE = 5;

    // what the table is currently showing
    const state = {
        filter: "all",   // all | deposit | withdrawal | repayment
        search: "",
        page: 1
    };

    let account = null;  // { member, loan, transactions }


    /* ---------------------------------------------------------------
       ELEMENTS
       --------------------------------------------------------------- */

    const el = {
        statSavings: document.getElementById("statSavings"),
        statSavingsText: document.getElementById("statSavingsText"),
        statLoan: document.getElementById("statLoan"),
        statLoanText: document.getElementById("statLoanText"),
        loanProgress: document.getElementById("loanProgress"),
        loanBar: document.getElementById("loanBar"),
        statNext: document.getElementById("statNext"),
        statNextText: document.getElementById("statNextText"),

        tableBody: document.getElementById("activityBody"),
        filterTabs: document.querySelectorAll(".filter-tab"),
        tableSearch: document.getElementById("tableSearch"),
        globalSearch: document.getElementById("globalSearch"),
        paginationInfo: document.getElementById("paginationInfo"),
        pageIndicator: document.getElementById("pageIndicator"),
        prevPage: document.getElementById("prevPage"),
        nextPage: document.getElementById("nextPage"),

        detailsDialog: document.getElementById("detailsDialog"),
        detailsBody: document.getElementById("detailsBody")
    };


    /* ---------------------------------------------------------------
       SMALL HELPERS
       --------------------------------------------------------------- */

    // whole days from today until an ISO date (negative = in the past)
    function daysUntil(isoDate) {
        const today = ui.todayIso().split("-").map(Number);
        const target = String(isoDate).split("-").map(Number);
        // Date.UTC avoids daylight-saving surprises when counting days
        const diff = Date.UTC(target[0], target[1] - 1, target[2]) -
                     Date.UTC(today[0], today[1] - 1, today[2]);
        return Math.round(diff / 86400000);
    }

    function plural(count, word) {
        return count + " " + word + (count === 1 ? "" : "s");
    }

    function typeLabel(type) {
        return type === "repayment" ? "Loan Repayment" : type;
    }

    function badge(kind, text) {
        return '<span class="badge badge-' + kind + '"><span class="badge-dot"></span>' +
            ui.escapeHtml(text) + "</span>";
    }

    // "TXN-2026-0042" -> 42 (keeps same-day entries in recorded order)
    function transactionNumber(t) {
        return Number(t.transaction_id.split("-")[2]) || 0;
    }


    /* ---------------------------------------------------------------
       STATISTIC CARDS
       --------------------------------------------------------------- */

    function renderStats() {
        const member = account.member;
        const loan = account.loan;

        // --- My Savings ---
        el.statSavings.textContent = ui.formatKES(member.savings_balance);
        el.statSavingsText.textContent = "Member since " + ui.formatDate(member.joined_at);

        // --- Outstanding Loan + progress bar ---
        if (!loan) {
            el.statLoan.textContent = ui.formatKES(0);
            el.statLoanText.textContent = "You have no active loan";
            el.loanProgress.hidden = true;
        } else {
            el.statLoan.textContent = ui.formatKES(loan.outstanding_balance);
            el.statLoanText.textContent =
                ui.formatKES(loan.amount_repaid) + " of " + ui.formatKES(loan.principal) +
                " repaid (" + loan.repaid_percent + "%)";
            el.loanProgress.hidden = false;
            el.loanProgress.setAttribute("aria-valuenow", String(loan.repaid_percent));
            el.loanBar.style.width = Math.min(loan.repaid_percent, 100) + "%";
        }

        // --- Next Repayment ---
        el.statNextText.classList.remove("is-overdue", "is-due-soon");

        if (!loan || loan.outstanding_balance === 0) {
            el.statNext.textContent = "–";
            el.statNextText.textContent = "No upcoming repayments";
            return;
        }

        el.statNext.textContent = ui.formatKES(loan.next_installment_amount);
        const days = daysUntil(loan.next_due_date);
        const due = ui.formatDate(loan.next_due_date);

        if (days < 0) {
            el.statNextText.textContent = "Overdue by " + plural(-days, "day") + " (was due " + due + ")";
            el.statNextText.classList.add("is-overdue");
        } else if (days === 0) {
            el.statNextText.textContent = "Due today (" + due + ")";
            el.statNextText.classList.add("is-due-soon");
        } else {
            el.statNextText.textContent = "Due " + due + " · in " + plural(days, "day");
            if (days <= 7) el.statNextText.classList.add("is-due-soon");
        }
    }


    /* ---------------------------------------------------------------
       ACTIVITY TABLE (newest first)
       --------------------------------------------------------------- */

    function getVisibleTransactions() {
        const query = state.search.trim().toLowerCase();

        return account.transactions
            .filter(function (t) {
                if (state.filter !== "all" && t.type !== state.filter) return false;
                if (!query) return true;
                return (
                    t.transaction_id.toLowerCase().indexOf(query) !== -1 ||
                    t.method.toLowerCase().indexOf(query) !== -1 ||
                    typeLabel(t.type).toLowerCase().indexOf(query) !== -1
                );
            })
            .sort(function (a, b) {
                return b.created_at.localeCompare(a.created_at) ||
                       transactionNumber(b) - transactionNumber(a);
            });
    }

    function renderTable() {
        const rows = getVisibleTransactions();
        const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
        state.page = Math.min(Math.max(1, state.page), totalPages);

        const start = (state.page - 1) * PAGE_SIZE;
        const pageRows = rows.slice(start, start + PAGE_SIZE);

        if (pageRows.length === 0) {
            const message = account.transactions.length === 0
                ? "You have no transactions yet."
                : "No transactions match your search or filter.";
            el.tableBody.innerHTML =
                '<tr class="empty-state"><td colspan="6">' +
                    '<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>' +
                    message +
                "</td></tr>";
        } else {
            el.tableBody.innerHTML = pageRows.map(function (t) {
                return (
                    '<tr tabindex="0" data-id="' + ui.escapeHtml(t.transaction_id) + '">' +
                        '<td class="cell-muted">' + ui.formatDate(t.created_at) + "</td>" +
                        '<td class="cell-id">' + ui.escapeHtml(t.transaction_id) + "</td>" +
                        "<td>" + badge(t.type, t.type === "repayment" ? "Repayment" : t.type) + "</td>" +
                        '<td class="align-right amount">' + Number(t.amount).toLocaleString("en-KE") + "</td>" +
                        "<td>" + ui.escapeHtml(t.method) + "</td>" +
                        "<td>" + badge(t.status, t.status) + "</td>" +
                    "</tr>"
                );
            }).join("");
        }

        el.paginationInfo.textContent = rows.length === 0
            ? "Showing 0 of 0"
            : "Showing " + (start + 1) + "–" + (start + pageRows.length) + " of " + rows.length;
        el.pageIndicator.textContent = "Page " + state.page + " of " + totalPages;
        el.prevPage.disabled = state.page <= 1;
        el.nextPage.disabled = state.page >= totalPages;
    }


    /* ---------------------------------------------------------------
       TABLE CONTROLS: filter, search, pages
       --------------------------------------------------------------- */

    el.filterTabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
            state.filter = tab.dataset.filter;
            state.page = 1;
            el.filterTabs.forEach(function (other) {
                const active = other === tab;
                other.classList.toggle("active", active);
                other.setAttribute("aria-pressed", String(active));
            });
            renderTable();
        });
    });

    // the top-bar search and the table search stay in sync
    function setSearch(value, source) {
        state.search = value;
        state.page = 1;
        if (source !== el.tableSearch) el.tableSearch.value = value;
        if (source !== el.globalSearch) el.globalSearch.value = value;
        renderTable();
    }

    el.tableSearch.addEventListener("input", function () { setSearch(el.tableSearch.value, el.tableSearch); });
    el.globalSearch.addEventListener("input", function () { setSearch(el.globalSearch.value, el.globalSearch); });
    el.globalSearch.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            document.getElementById("activity").scrollIntoView({ behavior: "smooth", block: "start" });
        }
    });

    el.prevPage.addEventListener("click", function () { state.page -= 1; renderTable(); });
    el.nextPage.addEventListener("click", function () { state.page += 1; renderTable(); });


    /* ---------------------------------------------------------------
       TRANSACTION DETAILS (read-only pop-up)
       --------------------------------------------------------------- */

    document.querySelectorAll("[data-close-dialog]").forEach(function (button) {
        button.addEventListener("click", function () { button.closest("dialog").close(); });
    });

    // clicking the dark backdrop closes the pop-up
    el.detailsDialog.addEventListener("click", function (event) {
        if (event.target === el.detailsDialog) el.detailsDialog.close();
    });

    function openDetails(transactionId) {
        const t = account.transactions.find(function (item) { return item.transaction_id === transactionId; });
        if (!t) return;

        const rows = [
            ["Transaction ID", t.transaction_id],
            ["Date", ui.formatDate(t.created_at)],
            ["Type", t.type === "repayment" ? "Loan Repayment" : t.type.charAt(0).toUpperCase() + t.type.slice(1)],
            ["Method", t.method],
            ["Status", t.status.charAt(0).toUpperCase() + t.status.slice(1)]
        ];

        el.detailsBody.innerHTML =
            '<div class="detail-amount">' +
                badge(t.type, typeLabel(t.type)) +
                '<span class="value">' + ui.formatKES(t.amount) + "</span>" +
                badge(t.status, t.status) +
            "</div>" +
            '<dl class="detail-list">' +
                rows.map(function (row) {
                    return "<dt>" + ui.escapeHtml(row[0]) + "</dt><dd>" + ui.escapeHtml(row[1]) + "</dd>";
                }).join("") +
            "</dl>";

        el.detailsDialog.showModal();
    }

    el.tableBody.addEventListener("click", function (event) {
        const row = event.target.closest("tr[data-id]");
        if (row) openDetails(row.dataset.id);
    });

    el.tableBody.addEventListener("keydown", function (event) {
        const row = event.target.closest("tr[data-id]");
        if (row && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            openDetails(row.dataset.id);
        }
    });


    /* ---------------------------------------------------------------
       START
       --------------------------------------------------------------- */

    (async function init() {
        try {
            account = await SaccoData.getMyAccount();
        } catch (error) {
            ui.toast(error.message);
            return;
        }
        renderStats();
        renderTable();
    })();
});
