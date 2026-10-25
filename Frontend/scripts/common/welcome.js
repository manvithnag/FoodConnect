/*
 * FoodConnect - Accessible Welcome Modal
 * Handles login, keyboard accessibility and session checks.
 */

const WELCOME_POPUP_INTERVAL = 30 * 1000;

let previousFocus = null;
let welcomeReminderTimer = null;
let loginCheckInProgress = false;
let welcomeLoginInProgress = false;

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(",");

function getModalFocusables(modal) {
  return [...modal.querySelectorAll(FOCUSABLE_SELECTOR)].filter(
    (element) =>
      element.getClientRects().length > 0 &&
      !element.disabled &&
      element.getAttribute("aria-hidden") !== "true" &&
      (
        element.type !== "radio" ||
        element.checked ||
        ![...modal.querySelectorAll(
          `input[type="radio"][name="${element.name}"]`
        )].some((radio) => radio.checked)
      )
  );
}

function openWelcome() {
  if (document.body.dataset.page !== "home") return;

  const modal = document.getElementById("welcome");
  if (!modal) return;

  const isOpening = modal.hidden;

  if (isOpening) {
    const activeElement = document.activeElement;

    previousFocus =
      activeElement && activeElement !== document.body
        ? activeElement
        : null;
  }

  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  if (isOpening) {
    const focusables = getModalFocusables(modal);
    const initialFocus =
      modal.querySelector(".modal-x") || focusables[0];

    if (initialFocus) {
      initialFocus.focus();
    } else {
      modal.setAttribute("tabindex", "-1");
      modal.focus();
    }
  }
}

function closeWelcome() {
  const modal = document.getElementById("welcome");
  if (!modal || modal.hidden) return;

  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");

  const focusTarget = previousFocus;
  previousFocus = null;

  if (
    focusTarget &&
    focusTarget.isConnected &&
    typeof focusTarget.focus === "function"
  ) {
    focusTarget.focus();
  }
}

/* Display errors in red and success messages in green. */
function showWelcomeMessage(message, isError = true) {
  const messageElement = document.getElementById("wMsg");
  if (!messageElement) return;

  messageElement.textContent = message;
  messageElement.style.display = message ? "block" : "none";

  if (isError) {
    messageElement.setAttribute("role", "alert");
    messageElement.style.color = "#b91c1c";
    messageElement.style.backgroundColor = "#fee2e2";
    messageElement.style.border = "1px solid #dc2626";
  } else {
    messageElement.setAttribute("role", "status");
    messageElement.style.color = "#166534";
    messageElement.style.backgroundColor = "#dcfce7";
    messageElement.style.border = "1px solid #16a34a";
  }

  messageElement.style.padding = "10px 12px";
  messageElement.style.borderRadius = "6px";
  messageElement.style.marginBottom = "12px";
}

function normalizeWelcomeRole(role) {
  role = String(role || "").trim().toLowerCase();

  if (["recipient", "organization"].includes(role)) {
    return "organisation";
  }

  return role;
}

async function handleWelcomeLogin(event) {
  event.preventDefault();

  if (welcomeLoginInProgress) return;

  const form = event.currentTarget;
  const emailInput = document.getElementById("wEmail");
  const passwordInput = document.getElementById("wPass");
  const submitButton = form.querySelector('button[type="submit"]');

  const selectedRole = form.querySelector(
    'input[name="wrole"]:checked'
  );

  showWelcomeMessage("");

  if (!emailInput || !passwordInput) {
    showWelcomeMessage("Login form fields could not be found.");
    return;
  }

  if (!form.reportValidity()) return;

  if (!selectedRole) {
    showWelcomeMessage("Please select your account type.");
    return;
  }

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  const role = normalizeWelcomeRole(selectedRole.value);

  welcomeLoginInProgress = true;

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Logging in...";
  }

  try {
    const result = await apiRequest("login.php", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        role
      })
    });

    if (!result?.success || !result?.user?.role) {
      throw new Error(
        result?.message || "Unable to verify your account."
      );
    }

    const authenticatedRole = normalizeWelcomeRole(
      result.user.role
    );

    showWelcomeMessage("Login successful.", false);
    closeWelcome();

    if (authenticatedRole === "admin") {
      window.location.replace("admin.html");
      return;
    }

    if (
      authenticatedRole === "donor" ||
      authenticatedRole === "organisation"
    ) {
      window.location.replace("dashboard.html");
      return;
    }

    throw new Error("Unrecognised account type.");

  } catch (error) {
    showWelcomeMessage(
      error.message || "Login failed. Please check your details.",
      true
    );

  } finally {
    welcomeLoginInProgress = false;

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Log in";
    }
  }
}

async function isLoggedIn() {
  try {
    const result = await getCurrentUser();
    return Boolean(result?.user);
  } catch (error) {
    return false;
  }
}

async function startWelcomeReminder() {
  if (document.body.dataset.page !== "home") return;

  const modal = document.getElementById("welcome");
  if (!modal) return;

  if (await isLoggedIn()) {
    if (!modal.hidden) closeWelcome();
    return;
  }

  openWelcome();

  if (welcomeReminderTimer !== null) {
    clearInterval(welcomeReminderTimer);
  }

  welcomeReminderTimer = setInterval(async () => {
    if (loginCheckInProgress) return;

    loginCheckInProgress = true;

    try {
      if (await isLoggedIn()) {
        clearInterval(welcomeReminderTimer);
        welcomeReminderTimer = null;

        const currentModal = document.getElementById("welcome");

        if (currentModal && !currentModal.hidden) {
          closeWelcome();
        }
      }
    } finally {
      loginCheckInProgress = false;
    }
  }, WELCOME_POPUP_INTERVAL);
}

// Submit the Welcome modal login form.
document.getElementById("wForm")?.addEventListener(
  "submit",
  handleWelcomeLogin
);

// Keyboard accessibility: Escape and Tab handling.
document.addEventListener("keydown", (event) => {
  const modal = document.getElementById("welcome");

  if (!modal || modal.hidden) return;

  if (event.key === "Escape") {
    event.preventDefault();
    closeWelcome();
    return;
  }

  if (event.key !== "Tab") return;

  const focusables = getModalFocusables(modal);

  if (focusables.length === 0) {
    event.preventDefault();
    modal.setAttribute("tabindex", "-1");
    modal.focus();
    return;
  }

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const activeElement = document.activeElement;

  if (!modal.contains(activeElement)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

// Close when the user clicks the popup backdrop.
document.addEventListener("click", (event) => {
  const modal = document.getElementById("welcome");

  if (modal && event.target === modal) {
    closeWelcome();
  }
});

// Preserve existing HTML onclick handlers.
window.openWelcome = openWelcome;
window.closeWelcome = closeWelcome;

// Start after the page is ready.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startWelcomeReminder);
} else {
  startWelcomeReminder();
}
