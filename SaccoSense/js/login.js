
// SHOW / HIDE PASSWORD

const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");

togglePassword.addEventListener("click", function () {
    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        togglePassword.textContent = "Hide";

    } else {
        passwordInput.type = "password";
        togglePassword.textContent = "Show";
    }
});


// ========== LOGIN FORM SUBMISSION ==========

const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

// TEMPORARY: passwords are not checked and the role comes from the selector.
// Members must use an email that belongs to a member (e.g.
// brian.odhiambo@example.com) so we know whose dashboard to show.
// Replace this with Supabase Auth (and roles stored in the database)
// when the backend is connected.

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const role = loginForm.querySelector('input[name="role"]:checked').value;
    const email = document.getElementById("email").value.trim();
    const remember = loginForm.querySelector('input[name="remember"]').checked;

    loginMessage.classList.remove("error");

    if (role === "member") {
        const member = await SaccoData.findMemberByEmail(email);
        if (!member) {
            loginMessage.textContent = "No member account uses this email address.";
            loginMessage.classList.add("error");
            return;
        }
    }

    // "Remember me" keeps the session after the browser closes;
    // otherwise it lasts only for this tab.
    const session = JSON.stringify({ role: role, email: email });
    localStorage.removeItem("saccosense_session");
    sessionStorage.removeItem("saccosense_session");
    (remember ? localStorage : sessionStorage).setItem("saccosense_session", session);

    loginMessage.textContent = "Signing you in...";

    if (role === "admin") {
        window.location.href = "admin/dashboard.html";
    } else {
        window.location.href = "member/dashboard.html";
    }
});
