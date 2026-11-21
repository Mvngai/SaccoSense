/* =====================================================================
   SaccoSense MEMBER PROFILE  (js/member-profile.js)
   ONE page for every member. It:
   1. reads the member ID from the link (?id=SS-0011)
   2. loads that member from Supabase (SaccoData.getMemberProfile)
   3. fills in the header, Personal Information and Financial Overview
   4. lets the admin edit details and activate / deactivate the member
   ===================================================================== */

// wait until data.js knows who is logged in (see SaccoData.ready)
SaccoData.ready.then(function () {
    "use strict";

    // app.js is already redirecting non-admins to the login page
    const currentUser = SaccoData.getCurrentUser();
    if (!currentUser || currentUser.role !== "admin") return;

    const ui = window.SaccoUI;

    // 1. Which member? e.g. "member-profile.html?id=SS-0011" -> "SS-0011"
    const memberId = new URLSearchParams(window.location.search).get("id");

    // the loaded profile ({ member, loan, last_transaction, has_login })
    let profile = null;


    /* ---------------------------------------------------------------
       ELEMENTS
       --------------------------------------------------------------- */

    const el = {
        message: document.getElementById("profileMessage"),
        content: document.getElementById("profileContent"),

        initials: document.getElementById("profileInitials"),
        name: document.getElementById("profileName"),
        memberId: document.getElementById("profileMemberId"),
        status: document.getElementById("profileStatus"),
        joined: document.getElementById("profileJoined"),
        personal: document.getElementById("personalDetails"),
        financial: document.getElementById("financialOverview"),

        openEdit: document.getElementById("openEditMember"),
        editDialog: document.getElementById("editMemberDialog"),
        editForm: document.getElementById("editMemberForm"),
        editError: document.getElementById("editMemberError"),
        editEmail: document.getElementById("editEmail"),
        editEmailHint: document.getElementById("editEmailHint"),
        saveEdit: document.getElementById("saveEditButton"),

        toggleStatus: document.getElementById("toggleStatusButton"),
        statusDialog: document.getElementById("statusDialog"),
        statusTitle: document.getElementById("statusTitle"),
        statusText: document.getElementById("statusText"),
        statusError: document.getElementById("statusError"),
        confirmStatus: document.getElementById("confirmStatusButton")
    };


    /* ---------------------------------------------------------------
       SMALL HELPERS
       --------------------------------------------------------------- */

    // Age in whole years from "YYYY-MM-DD"
    function ageFrom(isoDate) {
        const birth = new Date(isoDate + "T00:00:00");
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const hadBirthday =
            today.getMonth() > birth.getMonth() ||
            (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
        if (!hadBirthday) age -= 1;
        return age;
    }

    function badge(kind, text) {
        return '<span class="badge badge-' + kind + '"><span class="badge-dot"></span>' +
            ui.escapeHtml(text) + "</span>";
    }

    // Shows a message instead of the profile (e.g. "Member not found")
    function showMessage(icon, title, text) {
        el.content.hidden = true;
        el.message.hidden = false;
        el.message.innerHTML =
            '<i class="fa-solid ' + icon + '" aria-hidden="true"></i>' +
            "<h2>" + ui.escapeHtml(title) + "</h2>" +
            "<p>" + ui.escapeHtml(text) + "</p>" +
            '<a href="members.html" class="btn btn-primary">Back to members</a>';
    }


    /* ---------------------------------------------------------------
       RENDER THE PROFILE
       --------------------------------------------------------------- */

    function renderProfile() {
        const m = profile.member;

        document.title = m.full_name + " | SaccoSense";

        // --- header: name + member ID at the top ---
        el.initials.textContent = ui.initials(m.full_name);
        el.name.textContent = m.full_name;
        el.memberId.textContent = m.member_id;
        el.status.innerHTML = badge(m.status, m.status);
        el.joined.textContent = "Member since " + ui.formatDate(m.joined_at);

        // the button offers the opposite of the current status
        el.toggleStatus.innerHTML = m.status === "active"
            ? '<i class="fa-solid fa-user-slash" aria-hidden="true"></i> Deactivate'
            : '<i class="fa-solid fa-user-check" aria-hidden="true"></i> Reactivate';

        // --- personal information ---
        const personalRows = [
            ["Full name", m.full_name],
            ["National ID No.", m.national_id],
            ["Phone", ui.formatPhone(m.phone)],
            ["Email", m.email],
            ["Date of birth", m.date_of_birth
                ? ui.formatDate(m.date_of_birth) + " (" + ageFrom(m.date_of_birth) + " yrs)"
                : "Not provided"],
            ["Physical address", m.address || "Not provided"],
            ["Login account", profile.has_login ? "Activated" : "Not activated yet"]
        ];

        el.personal.innerHTML = personalRows.map(function (row) {
            return "<dt>" + ui.escapeHtml(row[0]) + "</dt><dd>" + ui.escapeHtml(row[1]) + "</dd>";
        }).join("");

        // --- financial overview (summary only) ---
        const loan = profile.loan;
        const last = profile.last_transaction;

        const cards = [
            {
                label: "Savings balance",
                value: ui.formatKES(m.savings_balance),
                note: "Current balance"
            },
            {
                label: "Outstanding loan",
                value: loan ? ui.formatKES(loan.outstanding_balance) : "KES 0",
                note: loan ? loan.loan_id + " · " + loan.repaid_percent + "% repaid" : "No active loan"
            },
            {
                label: "Next repayment",
                value: loan && loan.next_due_date ? ui.formatKES(loan.next_installment_amount) : "–",
                note: loan && loan.next_due_date ? "Due " + ui.formatDate(loan.next_due_date) : "Nothing due"
            },
            {
                label: "Last transaction",
                value: last ? ui.formatKES(last.amount) : "–",
                note: last
                    ? (last.type === "repayment" ? "Loan repayment" : last.type.charAt(0).toUpperCase() + last.type.slice(1)) +
                      " · " + ui.formatDate(last.created_at)
                    : "No transactions yet"
            }
        ];

        el.financial.innerHTML = cards.map(function (card) {
            return (
                '<div class="overview-item">' +
                    '<span class="overview-label">' + ui.escapeHtml(card.label) + "</span>" +
                    '<span class="overview-value">' + ui.escapeHtml(card.value) + "</span>" +
                    '<span class="overview-note">' + ui.escapeHtml(card.note) + "</span>" +
                "</div>"
            );
        }).join("");

        el.message.hidden = true;
        el.content.hidden = false;
    }

    // 2. Load the member from the database, then draw the page
    async function loadProfile() {
        profile = await SaccoData.getMemberProfile(memberId);
        if (!profile) {
            showMessage("fa-user-slash", "Member not found",
                "There is no member with the ID \"" + memberId + "\". They may have been entered incorrectly.");
            return;
        }
        renderProfile();
    }


    /* ---------------------------------------------------------------
       DIALOG HELPERS
       --------------------------------------------------------------- */

    document.querySelectorAll("[data-close-dialog]").forEach(function (button) {
        button.addEventListener("click", function () { button.closest("dialog").close(); });
    });

    // clicking the dark backdrop closes the pop-up
    [el.editDialog, el.statusDialog].forEach(function (dialog) {
        dialog.addEventListener("click", function (event) {
            if (event.target === dialog) dialog.close();
        });
    });

    function showError(box, message) {
        box.textContent = message;
        box.hidden = !message;
    }


    /* ---------------------------------------------------------------
       EDIT MEMBER
       --------------------------------------------------------------- */

    el.openEdit.addEventListener("click", function () {
        const m = profile.member;

        // pre-fill the form with the current details
        el.editForm.elements.full_name.value = m.full_name;
        el.editForm.elements.national_id.value = m.national_id;
        el.editForm.elements.phone.value = m.phone;
        el.editForm.elements.email.value = m.email;
        el.editForm.elements.date_of_birth.value = m.date_of_birth || "";
        el.editForm.elements.date_of_birth.max = ui.todayIso();
        el.editForm.elements.address.value = m.address || "";

        // Once the member has a login, their email is locked
        // (the database blocks the change too, see member-management.sql)
        el.editEmail.readOnly = profile.has_login;
        el.editEmailHint.textContent = profile.has_login
            ? "Locked: this member has activated their login with this email."
            : "The member will use this email to activate their login.";

        showError(el.editError, "");
        el.editDialog.showModal();
        el.editForm.elements.full_name.focus();
    });

    el.editForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const form = new FormData(el.editForm);

        el.saveEdit.disabled = true;
        showError(el.editError, "");

        try {
            await SaccoData.updateMember(profile.member.member_id, {
                full_name: form.get("full_name"),
                national_id: form.get("national_id"),
                phone: form.get("phone"),
                email: form.get("email"),
                date_of_birth: form.get("date_of_birth"),
                address: form.get("address")
            });

            el.editDialog.close();
            await loadProfile();
            ui.toast("Details updated for " + profile.member.full_name);
        } catch (error) {
            showError(el.editError, error.message);
        } finally {
            el.saveEdit.disabled = false;
        }
    });


    /* ---------------------------------------------------------------
       ACTIVATE / DEACTIVATE
       We never delete members: their transactions and loans must stay
       on record. Deactivating just marks them "inactive".
       --------------------------------------------------------------- */

    el.toggleStatus.addEventListener("click", function () {
        const m = profile.member;
        const deactivating = m.status === "active";

        el.statusTitle.textContent = deactivating ? "Deactivate member?" : "Reactivate member?";
        el.statusText.textContent = deactivating
            ? m.full_name + " (" + m.member_id + ") will be marked as inactive. " +
              "Their records, savings and loan history are kept, and you can reactivate them at any time."
            : m.full_name + " (" + m.member_id + ") will be marked as active again.";
        el.confirmStatus.textContent = deactivating ? "Deactivate" : "Reactivate";

        showError(el.statusError, "");
        el.statusDialog.showModal();
    });

    el.confirmStatus.addEventListener("click", async function () {
        const m = profile.member;
        const newStatus = m.status === "active" ? "inactive" : "active";

        el.confirmStatus.disabled = true;
        try {
            await SaccoData.setMemberStatus(m.member_id, newStatus);
            el.statusDialog.close();
            await loadProfile();
            ui.toast(m.full_name + " is now " + newStatus);
        } catch (error) {
            showError(el.statusError, error.message);
        } finally {
            el.confirmStatus.disabled = false;
        }
    });


    /* ---------------------------------------------------------------
       START
       --------------------------------------------------------------- */

    if (!memberId) {
        showMessage("fa-user-slash", "No member selected",
            "Open a member from the Members list to see their profile.");
        return;
    }

    loadProfile().catch(function (error) {
        showMessage("fa-triangle-exclamation", "Could not load this member", error.message);
    });
});
