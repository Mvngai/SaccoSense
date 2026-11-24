// ========== ACTIVATE ACCOUNT PAGE (pages/activate.html) ==========
//
// A member whose record the admin has already added comes here to
// create their login. Steps on submit:
//   1. Check the form (valid email, passwords match, 8+ characters).
//   2. Ask the database if the email belongs to a member
//      (SaccoData.checkActivationEmail -> check_activation_email()).
//   3. Create the login with Supabase signUp (SaccoData.activateAccount).
//      Supabase emails a confirmation link; the database trigger links
//      the login to the member record.


// SHOW / HIDE PASSWORD (same as the login page, but toggles both boxes)

const passwordInput = document.getElementById("password");
const confirmInput = document.getElementById("confirmPassword");
const togglePassword = document.getElementById("togglePassword");

togglePassword.addEventListener("click", function () {
    const show = passwordInput.type === "password";
    passwordInput.type = show ? "text" : "password";
    confirmInput.type = show ? "text" : "password";
    togglePassword.textContent = show ? "Hide" : "Show";
});


// ========== FORM SUBMISSION ==========

const activateForm = document.getElementById("activateForm");
const activateButton = document.getElementById("activateButton");
const activateMessage = document.getElementById("activateMessage");

// type = "error", "success" or "" (plain grey text)
function showMessage(text, type) {
    activateMessage.textContent = text;
    activateMessage.classList.remove("error", "success");
    if (type) activateMessage.classList.add(type);
}

activateForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    // emails are stored in lowercase in the members table
    const email = document.getElementById("email").value.trim().toLowerCase();
    const password = passwordInput.value;

    // 1. Check the form before contacting the server
    if (password.length < 8) {
        showMessage("Your password must be at least 8 characters long.", "error");
        return;
    }
    if (password !== confirmInput.value) {
        showMessage("The two passwords do not match.", "error");
        return;
    }

    // stop double clicks while we wait for the server
    activateButton.disabled = true;
    showMessage("Checking your details...", "");

    try {
        // 2. Is this a member's email, and is it still un-activated?
        const status = await SaccoData.checkActivationEmail(email);

        if (status === "not_member") {
            showMessage("This email isn't registered with the SACCO. Contact your SACCO admin.", "error");
            return;
        }
        if (status === "already_activated") {
            showMessage("This account has already been activated. Please sign in instead.", "error");
            return;
        }

        // 3. Create the login
        await SaccoData.activateAccount(email, password);

        // Success: hide the form fields so it isn't submitted twice
        activateForm.querySelectorAll(".form-group, #activateButton").forEach(function (element) {
            element.hidden = true;
        });
        showMessage("Almost done! We've sent a confirmation link to " + email +
            ". Click it, then sign in with your new password.", "success");

    } catch (error) {
        showMessage(error.message, "error");
    } finally {
        // runs after success, error, or an early "return" above
        activateButton.disabled = false;
    }
});
