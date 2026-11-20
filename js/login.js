
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

// Real login through Supabase Auth (SaccoData.signIn in data.js).
// Supabase checks the password. The user's ROLE comes from the database
// (profiles table), not from the Admin/Member selector, so nobody can
// make themselves an admin by picking "Admin".

function showLoginError(text) {
    loginMessage.textContent = text;
    loginMessage.classList.add("error");
}

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const chosenRole = loginForm.querySelector('input[name="role"]:checked').value;
    const email = document.getElementById("email").value.trim();
    const password = passwordInput.value;
    // "Remember me" keeps the user logged in after the browser closes
    const remember = loginForm.querySelector('input[name="remember"]').checked;

    loginMessage.classList.remove("error");
    loginMessage.textContent = "Signing you in...";

    try {
        const user = await SaccoData.signIn(email, password, remember);

        // the selected tab must match the account's real role
        if (user.role !== chosenRole) {
            await SaccoData.signOut();
            showLoginError("This is not " + (chosenRole === "admin" ? "an administrator" : "a member") +
                " account. Please choose the correct role.");
            return;
        }

        window.location.href = user.role === "admin" ? "admin/dashboard.html" : "member/dashboard.html";
    } catch (error) {
        showLoginError(error.message);
    }
});
