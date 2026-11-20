/* =====================================================================
   SaccoSense ADMIN DASHBOARD  (js/dashboard.js)
   - statistic cards
   - recent transactions table: filter tabs, search, sorting,
     10 rows per page, record transaction, row details
   All data comes from SaccoData (js/data.js).
   ===================================================================== */

// wait until data.js knows who is logged in (see SaccoData.ready)
SaccoData.ready.then(function () {
    "use strict";

    // app.js is already redirecting to the login page
    const currentUser = SaccoData.getCurrentUser();
    if (!currentUser || currentUser.role !== "admin") return;

    const ui = window.SaccoUI;
    const PAGE_SIZE = 10;

    // what the table is currently showing
    const state = {
        filter: "all",          // all | deposit | withdrawal | repayment
        search: "",
        sortKey: "created_at",  // created_at | amount
        sortDir: "desc",        // asc | desc
        page: 1
    };

    let transactions = [];
    let membersById = {};


    /* ---------------------------------------------------------------
       ELEMENTS
       --------------------------------------------------------------- */

    const el = {
        statMembers: document.getElementById("statMembers"),
        statMembersText: document.getElementById("statMembersText"),
        statSavings: document.getElementById("statSavings"),
        statRepayment: document.getElementById("statRepayment"),
        statRepaymentText: document.getElementById("statRepaymentText"),
        repaymentBar: document.getElementById("repaymentBar"),

        tableBody: document.getElementById("transactionsBody"),
        filterTabs: document.querySelectorAll(".filter-tab"),
        sortHeaders: document.querySelectorAll("th[data-sort-key]"),
        tableSearch: document.getElementById("tableSearch"),
        globalSearch: document.getElementById("globalSearch"),
        paginationInfo: document.getElementById("paginationInfo"),
        pageIndicator: document.getElementById("pageIndicator"),
        prevPage: document.getElementById("prevPage"),
        nextPage: document.getElementById("nextPage"),

        recordDialog: document.getElementById("recordDialog"),
        recordForm: document.getElementById("recordForm"),
        recordError: document.getElementById("recordError"),
        openRecordForm: document.getElementById("openRecordForm"),
        fieldMember: document.getElementById("fieldMember"),
        fieldType: document.getElementById("fieldType"),
        fieldDate: document.getElementById("fieldDate"),
        memberBalanceHint: document.getElementById("memberBalanceHint"),

        detailsDialog: document.getElementById("detailsDialog"),
        detailsBody: document.getElementById("detailsBody")
    };


    /* ---------------------------------------------------------------
       LOAD DATA
       --------------------------------------------------------------- */

    async function loadData() {
        const results = await Promise.all([SaccoData.getTransactions(), SaccoData.getMembers()]);
        transactions = results[0];
        membersById = {};
        results[1].forEach(function (m) { membersById[m.member_id] = m; });
    }

    function memberName(memberId) {
        return membersById[memberId] ? membersById[memberId].full_name : "Unknown member";
    }

    // "TXN-2026-0042" -> 42 (used to keep same-day entries in order)
    function transactionNumber(t) {
        return Number(t.transaction_id.split("-")[2]) || 0;
    }


    /* ---------------------------------------------------------------
       STATISTIC CARDS
       --------------------------------------------------------------- */

    async function renderStats() {
        const stats = await SaccoData.getStats();

        el.statMembers.textContent = stats.total_members.toLocaleString("en-KE");
        el.statMembersText.textContent = stats.active_members + " active members";

        el.statSavings.textContent = ui.formatKES(stats.total_savings);

        el.statRepayment.textContent = stats.repayment_rate + "%";
        el.statRepaymentText.textContent =
            stats.installments_paid_on_time + " of " + stats.installments_due + " instalments paid on time";
        el.repaymentBar.style.width = Math.min(stats.repayment_rate, 100) + "%";
    }


    /* ---------------------------------------------------------------
       TABLE
       --------------------------------------------------------------- */

    function getVisibleTransactions() {
        const query = state.search.trim().toLowerCase();

        const filtered = transactions.filter(function (t) {
            if (state.filter !== "all" && t.type !== state.filter) return false;
            if (!query) return true;
            return (
                memberName(t.member_id).toLowerCase().indexOf(query) !== -1 ||
                t.transaction_id.toLowerCase().indexOf(query) !== -1 ||
                t.member_id.toLowerCase().indexOf(query) !== -1
            );
        });

        const direction = state.sortDir === "asc" ? 1 : -1;

        return filtered.sort(function (a, b) {
            let result;
            if (state.sortKey === "amount") {
                result = a.amount - b.amount;
            } else {
                result = a.created_at.localeCompare(b.created_at);
            }
            // tie-break: order they were recorded
            if (result === 0) result = transactionNumber(a) - transactionNumber(b);
            return result * direction;
        });
    }

    function badge(kind, text) {
        return '<span class="badge badge-' + kind + '"><span class="badge-dot"></span>' +
            ui.escapeHtml(text) + "</span>";
    }

    function renderTable(highlightId) {
        const rows = getVisibleTransactions();
        const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
        state.page = Math.min(Math.max(1, state.page), totalPages);

        const start = (state.page - 1) * PAGE_SIZE;
        const pageRows = rows.slice(start, start + PAGE_SIZE);

        if (pageRows.length === 0) {
            el.tableBody.innerHTML =
                '<tr class="empty-state"><td colspan="7">' +
                    '<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>' +
                    "No transactions match your search or filter." +
                "</td></tr>";
        } else {
            el.tableBody.innerHTML = pageRows.map(function (t) {
                const typeLabel = t.type === "repayment" ? "Repayment" : t.type;
                return (
                    '<tr tabindex="0" data-id="' + ui.escapeHtml(t.transaction_id) + '"' +
                        (t.transaction_id === highlightId ? ' class="just-added"' : "") + ">" +
                        '<td class="cell-muted">' + ui.formatDate(t.created_at) + "</td>" +
                        '<td class="cell-id">' + ui.escapeHtml(t.transaction_id) + "</td>" +
                        '<td class="member-cell"><strong>' + ui.escapeHtml(memberName(t.member_id)) +
                            "</strong><small>" + ui.escapeHtml(t.member_id) + "</small></td>" +
                        "<td>" + badge(t.type, typeLabel) + "</td>" +
                        '<td class="align-right amount">' +
                            Number(t.amount).toLocaleString("en-KE") + "</td>" +
                        "<td>" + ui.escapeHtml(t.method) + "</td>" +
                        "<td>" + badge(t.status, t.status) + "</td>" +
                    "</tr>"
                );
            }).join("");
        }

        // pagination text + buttons
        el.paginationInfo.textContent = rows.length === 0
            ? "Showing 0 of 0"
            : "Showing " + (start + 1) + "–" + (start + pageRows.length) + " of " + rows.length;
        el.pageIndicator.textContent = "Page " + state.page + " of " + totalPages;
        el.prevPage.disabled = state.page <= 1;
        el.nextPage.disabled = state.page >= totalPages;

        renderSortHeaders();
    }

    function renderSortHeaders() {
        el.sortHeaders.forEach(function (th) {
            const icon = th.querySelector(".sort-button i");
            if (th.dataset.sortKey === state.sortKey) {
                const ascending = state.sortDir === "asc";
                th.setAttribute("aria-sort", ascending ? "ascending" : "descending");
                icon.className = "fa-solid " + (ascending ? "fa-sort-up" : "fa-sort-down");
            } else {
                th.setAttribute("aria-sort", "none");
                icon.className = "fa-solid fa-sort";
            }
        });
    }


    /* ---------------------------------------------------------------
       TABLE CONTROLS: filter, search, sort, pages
       --------------------------------------------------------------- */

    function setFilter(filter) {
        state.filter = filter;
        state.page = 1;
        el.filterTabs.forEach(function (tab) {
            const active = tab.dataset.filter === filter;
            tab.classList.toggle("active", active);
            tab.setAttribute("aria-pressed", String(active));
        });
    }

    el.filterTabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
            setFilter(tab.dataset.filter);
            renderTable();
        });
    });

    // the top-bar search and the table search stay in sync
    function setSearch(value, source) {
        state.search = value;
        state.page = 1;
        if (source !== el.tableSearch) el.tableSearch.value = value;
        if (el.globalSearch && source !== el.globalSearch) el.globalSearch.value = value;
        renderTable();
    }

    el.tableSearch.addEventListener("input", function () { setSearch(el.tableSearch.value, el.tableSearch); });

    if (el.globalSearch) {
        el.globalSearch.addEventListener("input", function () { setSearch(el.globalSearch.value, el.globalSearch); });
        el.globalSearch.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                document.getElementById("transactions").scrollIntoView({ behavior: "smooth", block: "start" });
            }
        });
    }

    el.sortHeaders.forEach(function (th) {
        th.querySelector(".sort-button").addEventListener("click", function () {
            const key = th.dataset.sortKey;
            if (state.sortKey === key) {
                state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
            } else {
                state.sortKey = key;
                state.sortDir = "desc";
            }
            state.page = 1;
            renderTable();
        });
    });

    el.prevPage.addEventListener("click", function () { state.page -= 1; renderTable(); });
    el.nextPage.addEventListener("click", function () { state.page += 1; renderTable(); });


    /* ---------------------------------------------------------------
       DIALOG HELPERS
       --------------------------------------------------------------- */

    document.querySelectorAll("[data-close-dialog]").forEach(function (button) {
        button.addEventListener("click", function () { button.closest("dialog").close(); });
    });

    // clicking the dark backdrop closes the pop-up
    [el.recordDialog, el.detailsDialog].forEach(function (dialog) {
        dialog.addEventListener("click", function (event) {
            if (event.target === dialog) dialog.close();
        });
    });


    /* ---------------------------------------------------------------
       TRANSACTION DETAILS
       --------------------------------------------------------------- */

    function openDetails(transactionId) {
        const t = transactions.find(function (item) { return item.transaction_id === transactionId; });
        if (!t) return;
        const member = membersById[t.member_id] || {};
        const typeLabel = t.type === "repayment" ? "Loan Repayment" : t.type;

        const rows = [
            ["Transaction ID", t.transaction_id],
            ["Date", ui.formatDate(t.created_at)],
            ["Member", member.full_name || "Unknown member"],
            ["Member No.", t.member_id],
            ["Phone", member.phone ? ui.formatPhone(member.phone) : "–"],
            ["Method", t.method],
            ["Member's current savings", member.savings_balance !== undefined ? ui.formatKES(member.savings_balance) : "–"]
        ];

        el.detailsBody.innerHTML =
            '<div class="detail-amount">' +
                badge(t.type, typeLabel) +
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
       RECORD TRANSACTION
       --------------------------------------------------------------- */

    function fillMemberOptions() {
        const members = Object.values(membersById).sort(function (a, b) {
            return a.full_name.localeCompare(b.full_name);
        });
        el.fieldMember.innerHTML = '<option value="">Select a member</option>' +
            members.map(function (m) {
                return '<option value="' + ui.escapeHtml(m.member_id) + '">' +
                    ui.escapeHtml(m.full_name) + " (" + ui.escapeHtml(m.member_id) + ")</option>";
            }).join("");
    }

    function updateBalanceHint() {
        const member = membersById[el.fieldMember.value];
        el.memberBalanceHint.textContent = member
            ? "Current savings balance: " + ui.formatKES(member.savings_balance)
            : "";
    }

    function showFormError(message) {
        el.recordError.textContent = message;
        el.recordError.hidden = !message;
    }

    el.openRecordForm.addEventListener("click", function () {
        el.recordForm.reset();
        fillMemberOptions();
        el.fieldDate.value = ui.todayIso();
        el.fieldDate.max = ui.todayIso();
        updateBalanceHint();
        showFormError("");
        el.recordDialog.showModal();
        el.fieldMember.focus();
    });

    el.fieldMember.addEventListener("change", updateBalanceHint);

    el.recordForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const form = new FormData(el.recordForm);

        try {
            const saved = await SaccoData.addTransaction({
                member_id: form.get("member_id"),
                type: form.get("type"),
                amount: form.get("amount"),
                method: form.get("method"),
                status: form.get("status"),
                created_at: form.get("created_at")
            });

            el.recordDialog.close();
            await loadData();
            await renderStats();

            // show the new entry: clear search, newest first, page 1
            if (state.filter !== "all" && state.filter !== saved.type) setFilter("all");
            state.sortKey = "created_at";
            state.sortDir = "desc";
            setSearch("", null);
            renderTable(saved.transaction_id);

            ui.toast(saved.transaction_id + " recorded for " + memberName(saved.member_id));
        } catch (error) {
            showFormError(error.message);
        }
    });


    /* ---------------------------------------------------------------
       START
       --------------------------------------------------------------- */

    (async function init() {
        await loadData();
        await renderStats();
        renderTable();
    })();
});
