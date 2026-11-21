/* =====================================================================
   SaccoSense MEMBER MANAGEMENT  (js/members.js)
   - members table: search, status filter, sort, 10 rows per page
   - clicking a row opens member-profile.html?id=SS-....
   - "Add Member" pop-up that registers a new member
   All data comes from SaccoData (js/data.js).
   ===================================================================== */

// wait until data.js knows who is logged in (see SaccoData.ready)
SaccoData.ready.then(function () {
    "use strict";

    // app.js is already redirecting non-admins to the login page
    const currentUser = SaccoData.getCurrentUser();
    if (!currentUser || currentUser.role !== "admin") return;

    const ui = window.SaccoUI;
    const PAGE_SIZE = 10;

    // what the table is currently showing
    const state = {
        search: "",
        status: "all",     // all | active | inactive
        sort: "newest",    // newest | oldest | name | id
        page: 1
    };

    let members = [];


    /* ---------------------------------------------------------------
       ELEMENTS
       --------------------------------------------------------------- */

    const el = {
        search: document.getElementById("memberSearch"),
        filterMenu: document.getElementById("filterMenu"),
        filterDot: document.getElementById("filterDot"),
        resetFilters: document.getElementById("resetFilters"),

        counts: document.getElementById("memberCounts"),
        tableBody: document.getElementById("membersBody"),
        paginationInfo: document.getElementById("paginationInfo"),
        pageIndicator: document.getElementById("pageIndicator"),
        prevPage: document.getElementById("prevPage"),
        nextPage: document.getElementById("nextPage"),

        openAddMember: document.getElementById("openAddMember"),
        addDialog: document.getElementById("addMemberDialog"),
        addForm: document.getElementById("addMemberForm"),
        addError: document.getElementById("addMemberError"),
        saveButton: document.getElementById("saveMemberButton"),
        fieldDob: document.getElementById("fieldDob")
    };


    /* ---------------------------------------------------------------
       TABLE
       --------------------------------------------------------------- */

    // Applies the search box, status filter and sort order
    function getVisibleMembers() {
        const query = state.search.trim().toLowerCase();
        const queryDigits = query.replace(/\D/g, "");   // so "0712 345" matches "0712345678"

        const filtered = members.filter(function (m) {
            if (state.status !== "all" && m.status !== state.status) return false;
            if (!query) return true;
            return (
                m.full_name.toLowerCase().indexOf(query) !== -1 ||
                m.member_id.toLowerCase().indexOf(query) !== -1 ||
                m.email.toLowerCase().indexOf(query) !== -1 ||
                (m.national_id || "").toLowerCase().indexOf(query) !== -1 ||
                (queryDigits.length >= 3 && m.phone.indexOf(queryDigits) !== -1)
            );
        });

        return filtered.sort(function (a, b) {
            if (state.sort === "name") return a.full_name.localeCompare(b.full_name);
            if (state.sort === "id") return a.member_id.localeCompare(b.member_id);
            // newest/oldest by join date; member ID breaks ties (same-day joins)
            const result = a.joined_at.localeCompare(b.joined_at) || a.member_id.localeCompare(b.member_id);
            return state.sort === "oldest" ? result : -result;
        });
    }

    function statusBadge(status) {
        return '<span class="badge badge-' + status + '"><span class="badge-dot"></span>' +
            ui.escapeHtml(status) + "</span>";
    }

    function renderCounts() {
        const active = members.filter(function (m) { return m.status === "active"; }).length;
        el.counts.textContent = members.length + " registered · " + active + " active";
    }

    function renderTable(highlightId) {
        const rows = getVisibleMembers();
        const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
        state.page = Math.min(Math.max(1, state.page), totalPages);

        const start = (state.page - 1) * PAGE_SIZE;
        const pageRows = rows.slice(start, start + PAGE_SIZE);

        if (pageRows.length === 0) {
            el.tableBody.innerHTML =
                '<tr class="empty-state"><td colspan="5">' +
                    '<i class="fa-solid fa-user-slash" aria-hidden="true"></i>' +
                    (members.length === 0 ? "No members registered yet." : "No members match your search or filter.") +
                "</td></tr>";
        } else {
            // escapeHtml protects the page if a name contains HTML characters
            el.tableBody.innerHTML = pageRows.map(function (m) {
                return (
                    '<tr tabindex="0" data-id="' + ui.escapeHtml(m.member_id) + '"' +
                        (m.member_id === highlightId ? ' class="just-added"' : "") + ">" +
                        '<td class="cell-id">' + ui.escapeHtml(m.member_id) + "</td>" +
                        '<td class="member-name-cell">' +
                            '<span class="avatar avatar-sm" aria-hidden="true">' + ui.escapeHtml(ui.initials(m.full_name)) + "</span>" +
                            "<strong>" + ui.escapeHtml(m.full_name) + "</strong>" +
                        "</td>" +
                        "<td>" + ui.escapeHtml(ui.formatPhone(m.phone)) + "</td>" +
                        '<td class="cell-muted">' + ui.formatDate(m.joined_at) + "</td>" +
                        "<td>" + statusBadge(m.status) + "</td>" +
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

        // small dot on the filter button when a non-default filter is on
        el.filterDot.hidden = state.status === "all" && state.sort === "newest";
    }

    async function loadMembers() {
        members = await SaccoData.getMembers();
        renderCounts();
    }


    /* ---------------------------------------------------------------
       SEARCH, FILTER, PAGES
       --------------------------------------------------------------- */

    el.search.addEventListener("input", function () {
        state.search = el.search.value;
        state.page = 1;
        renderTable();
    });

    // the radio buttons inside the filter dropdown
    el.filterMenu.addEventListener("change", function (event) {
        if (event.target.name === "statusFilter") state.status = event.target.value;
        if (event.target.name === "sortOrder") state.sort = event.target.value;
        state.page = 1;
        renderTable();
    });

    el.resetFilters.addEventListener("click", function () {
        el.filterMenu.querySelector('input[name="statusFilter"][value="all"]').checked = true;
        el.filterMenu.querySelector('input[name="sortOrder"][value="newest"]').checked = true;
        state.status = "all";
        state.sort = "newest";
        state.page = 1;
        renderTable();
    });

    el.prevPage.addEventListener("click", function () { state.page -= 1; renderTable(); });
    el.nextPage.addEventListener("click", function () { state.page += 1; renderTable(); });


    /* ---------------------------------------------------------------
       OPEN A MEMBER'S PROFILE
       One shared profile page; the member ID travels in the link.
       encodeURIComponent makes the ID safe to put in a URL.
       --------------------------------------------------------------- */

    function openProfile(memberId) {
        window.location.href = "member-profile.html?id=" + encodeURIComponent(memberId);
    }

    el.tableBody.addEventListener("click", function (event) {
        const row = event.target.closest("tr[data-id]");
        if (row) openProfile(row.dataset.id);
    });

    // keyboard users: Enter or Space on a focused row
    el.tableBody.addEventListener("keydown", function (event) {
        const row = event.target.closest("tr[data-id]");
        if (row && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            openProfile(row.dataset.id);
        }
    });


    /* ---------------------------------------------------------------
       ADD MEMBER
       --------------------------------------------------------------- */

    function showFormError(message) {
        el.addError.textContent = message;
        el.addError.hidden = !message;
    }

    el.openAddMember.addEventListener("click", function () {
        el.addForm.reset();
        el.fieldDob.max = ui.todayIso();   // no birth dates in the future
        showFormError("");
        el.addDialog.showModal();
        document.getElementById("fieldFullName").focus();
    });

    // close buttons and clicking the dark backdrop
    document.querySelectorAll("[data-close-dialog]").forEach(function (button) {
        button.addEventListener("click", function () { button.closest("dialog").close(); });
    });
    el.addDialog.addEventListener("click", function (event) {
        if (event.target === el.addDialog) el.addDialog.close();
    });

    el.addForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const form = new FormData(el.addForm);

        // disable the button while saving so a double-click can't register twice
        el.saveButton.disabled = true;
        showFormError("");

        try {
            // data.js checks the fields, then the database saves them
            // and generates the Member ID
            const saved = await SaccoData.addMember({
                full_name: form.get("full_name"),
                national_id: form.get("national_id"),
                phone: form.get("phone"),
                email: form.get("email"),
                date_of_birth: form.get("date_of_birth"),
                address: form.get("address")
            });

            el.addDialog.close();
            await loadMembers();

            // show the new member: clear the search, newest first, page 1
            el.search.value = "";
            state.search = "";
            if (state.status === "inactive") state.status = "all";
            el.filterMenu.querySelector('input[name="statusFilter"][value="' + state.status + '"]').checked = true;
            state.sort = "newest";
            el.filterMenu.querySelector('input[name="sortOrder"][value="newest"]').checked = true;
            state.page = 1;
            renderTable(saved.member_id);

            ui.toast(saved.full_name + " registered as " + saved.member_id);
        } catch (error) {
            showFormError(error.message);
        } finally {
            el.saveButton.disabled = false;
        }
    });


    /* ---------------------------------------------------------------
       START
       --------------------------------------------------------------- */

    (async function init() {
        try {
            await loadMembers();
            renderTable();
        } catch (error) {
            el.counts.textContent = "Could not load members.";
            el.tableBody.innerHTML =
                '<tr class="empty-state"><td colspan="5">' +
                    '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>' +
                    ui.escapeHtml(error.message) +
                "</td></tr>";
        }
    })();
});
