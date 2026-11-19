/* =====================================================================
   SaccoSense APP SHELL  (js/app.js)
   Shared by every logged-in page:
   - login check (role guard)
   - sidebar: collapse on desktop, slide-in on phones, active link
   - top bar: notifications + profile dropdowns, logout, reset data
   - small helpers every page can use (SaccoUI)
   Load order on a page: data.js -> app.js -> page script.
   ===================================================================== */

(function () {
    "use strict";

    const body = document.body;
    const MOBILE_QUERY = window.matchMedia("(max-width: 900px)");
    const COLLAPSE_KEY = "saccosense_sidebar_collapsed";


    /* ---------------------------------------------------------------
       HELPERS (available to page scripts as window.SaccoUI)
       --------------------------------------------------------------- */

    const SaccoUI = {

        formatKES: function (amount) {
            return "KES " + Number(amount).toLocaleString("en-KE", { maximumFractionDigits: 2 });
        },

        // "2026-11-05" -> "05/11/2026"
        formatDate: function (isoDate) {
            const parts = String(isoDate).slice(0, 10).split("-");
            return parts.length === 3 ? parts[2] + "/" + parts[1] + "/" + parts[0] : isoDate;
        },

        // "0712345678" -> "0712 345 678"
        formatPhone: function (phone) {
            const digits = String(phone).replace(/\D/g, "");
            return digits.length === 10
                ? digits.slice(0, 4) + " " + digits.slice(4, 7) + " " + digits.slice(7)
                : phone;
        },

        // "Grace Wanjiku" -> "GW"
        initials: function (name) {
            return String(name).split(" ").filter(Boolean).slice(0, 2)
                .map(function (word) { return word[0].toUpperCase(); }).join("");
        },

        // Always use this before putting data into innerHTML
        escapeHtml: function (value) {
            return String(value)
                .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
        },

        // Today's date as "YYYY-MM-DD" in local time
        todayIso: function () {
            const now = new Date();
            return now.getFullYear() + "-" +
                String(now.getMonth() + 1).padStart(2, "0") + "-" +
                String(now.getDate()).padStart(2, "0");
        },

        toast: function (message) {
            let toast = document.getElementById("toast");
            if (!toast) {
                toast = document.createElement("div");
                toast.id = "toast";
                toast.className = "toast";
                toast.setAttribute("role", "status");
                toast.setAttribute("aria-live", "polite");
                body.appendChild(toast);
            }
            toast.textContent = message;
            toast.classList.add("show");
            clearTimeout(toast.hideTimer);
            toast.hideTimer = setTimeout(function () { toast.classList.remove("show"); }, 3200);
        }
    };

    window.SaccoUI = SaccoUI;


    /* ---------------------------------------------------------------
       ROLE GUARD
       <body data-required-role="admin" data-login-url="../login.html">
       --------------------------------------------------------------- */

    const requiredRole = body.dataset.requiredRole;
    const loginUrl = body.dataset.loginUrl || "../login.html";
    const user = SaccoData.getCurrentUser();

    if (requiredRole && (!user || user.role !== requiredRole)) {
        window.location.replace(loginUrl);
        return;
    }


    /* ---------------------------------------------------------------
       SIDEBAR
       --------------------------------------------------------------- */

    const sidebarToggle = document.getElementById("sidebarToggle");
    const sidebarOverlay = document.getElementById("sidebarOverlay");

    // restore the desktop collapsed/expanded choice
    try {
        if (localStorage.getItem(COLLAPSE_KEY) === "true") body.classList.add("sidebar-collapsed");
    } catch (error) { /* ignore */ }

    // enable animations only after the first paint (prevents a flash on load)
    requestAnimationFrame(function () {
        requestAnimationFrame(function () { body.classList.add("shell-ready"); });
    });

    function closeMobileSidebar() {
        body.classList.remove("sidebar-open");
        if (sidebarToggle) sidebarToggle.setAttribute("aria-expanded", "false");
    }

    if (sidebarToggle) {
        sidebarToggle.addEventListener("click", function () {
            if (MOBILE_QUERY.matches) {
                const open = body.classList.toggle("sidebar-open");
                sidebarToggle.setAttribute("aria-expanded", String(open));
            } else {
                const collapsed = body.classList.toggle("sidebar-collapsed");
                sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
                try { localStorage.setItem(COLLAPSE_KEY, String(collapsed)); } catch (error) { /* ignore */ }
            }
        });
    }

    if (sidebarOverlay) sidebarOverlay.addEventListener("click", closeMobileSidebar);

    // leaving phone size closes the slide-in sidebar
    MOBILE_QUERY.addEventListener("change", closeMobileSidebar);

    // highlight the current page: <body data-page="dashboard"> + <a data-page="dashboard">
    document.querySelectorAll(".sidebar-link[data-page]").forEach(function (link) {
        if (link.dataset.page === body.dataset.page) {
            link.classList.add("active");
            link.setAttribute("aria-current", "page");
        }
        // labels become tooltips when the sidebar is collapsed to icons
        const label = link.querySelector("span");
        if (label) link.title = label.textContent;
    });


    /* ---------------------------------------------------------------
       DROPDOWNS (any button with data-dropdown="menuId")
       --------------------------------------------------------------- */

    const dropdownButtons = document.querySelectorAll("[data-dropdown]");

    function closeAllDropdowns(except) {
        dropdownButtons.forEach(function (button) {
            const menu = document.getElementById(button.dataset.dropdown);
            if (menu && menu !== except) {
                menu.hidden = true;
                button.setAttribute("aria-expanded", "false");
            }
        });
    }

    dropdownButtons.forEach(function (button) {
        const menu = document.getElementById(button.dataset.dropdown);
        if (!menu) return;

        button.addEventListener("click", function (event) {
            event.stopPropagation();
            const willOpen = menu.hidden;
            closeAllDropdowns(menu);
            menu.hidden = !willOpen;
            button.setAttribute("aria-expanded", String(willOpen));
        });

        // clicks inside the menu shouldn't close it
        menu.addEventListener("click", function (event) { event.stopPropagation(); });
    });

    document.addEventListener("click", function () { closeAllDropdowns(); });

    document.addEventListener("keydown", function (event) {
        if (event.key !== "Escape") return;
        closeAllDropdowns();
        closeMobileSidebar();
    });


    /* ---------------------------------------------------------------
       PROFILE
       --------------------------------------------------------------- */

    document.querySelectorAll("[data-user-name]").forEach(function (el) {
        el.textContent = user ? user.full_name : "";
    });
    document.querySelectorAll("[data-user-first-name]").forEach(function (el) {
        el.textContent = user ? user.full_name.split(" ")[0] : "";
    });
    document.querySelectorAll("[data-user-initials]").forEach(function (el) {
        el.textContent = user ? SaccoUI.initials(user.full_name) : "";
    });
    // members: their member number (e.g. SS-0011) under their name
    document.querySelectorAll("[data-user-member-no]").forEach(function (el) {
        el.textContent = user && user.member_id ? user.member_id : "";
    });

    document.querySelectorAll('[data-action="logout"]').forEach(function (button) {
        button.addEventListener("click", function () {
            SaccoData.signOut();
            window.location.href = loginUrl;
        });
    });

    // TESTING ONLY: remove when Supabase is connected
    document.querySelectorAll('[data-action="reset-data"]').forEach(function (button) {
        button.addEventListener("click", async function () {
            const ok = window.confirm(
                "This will undo all your changes and restore the original sample data. Continue?"
            );
            if (!ok) return;
            await SaccoData.resetData();
            window.location.reload();
        });
    });


    /* ---------------------------------------------------------------
       NOTIFICATIONS
       --------------------------------------------------------------- */

    const NOTIFICATION_ICONS = {
        loan: "fa-hand-holding-dollar",
        overdue: "fa-triangle-exclamation",
        transaction: "fa-money-bill-transfer",
        member: "fa-user-plus",
        report: "fa-file-lines"
    };

    const notificationList = document.getElementById("notificationList");
    const notificationBadge = document.getElementById("notificationBadge");
    const markAllReadButton = document.getElementById("markAllRead");

    async function renderNotifications() {
        if (!notificationList) return;
        const notifications = await SaccoData.getNotifications();
        const unread = notifications.filter(function (n) { return !n.is_read; }).length;

        if (notificationBadge) {
            notificationBadge.textContent = unread;
            notificationBadge.hidden = unread === 0;
        }
        const bell = document.querySelector('[data-dropdown="notificationMenu"]');
        if (bell) bell.setAttribute("aria-label", "Notifications, " + unread + " unread");
        if (markAllReadButton) markAllReadButton.hidden = unread === 0;

        notificationList.innerHTML = notifications.map(function (n) {
            const icon = NOTIFICATION_ICONS[n.category] || "fa-bell";
            return (
                '<li class="notification-item' + (n.is_read ? "" : " unread") + '">' +
                    '<span class="notification-icon ' + SaccoUI.escapeHtml(n.category) + '">' +
                        '<i class="fa-solid ' + icon + '" aria-hidden="true"></i>' +
                    "</span>" +
                    "<div>" +
                        '<p class="notification-message">' + SaccoUI.escapeHtml(n.message) + "</p>" +
                        '<span class="notification-date">' + SaccoUI.formatDate(n.created_at) + "</span>" +
                    "</div>" +
                    (n.is_read ? "" : '<span class="unread-dot" aria-label="Unread"></span>') +
                "</li>"
            );
        }).join("");
    }

    if (markAllReadButton) {
        markAllReadButton.addEventListener("click", async function () {
            await SaccoData.markAllNotificationsRead();
            renderNotifications();
        });
    }

    renderNotifications();
})();
