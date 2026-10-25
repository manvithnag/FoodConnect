/*
 * FoodConnect - Registration Page
 * Sends registration details to the PHP backend.
 */

const registerForm = $("#regForm");
const registerMessage = $("#rNote");
const registrationPassword = $("#rPass");
const passwordStrength = $("#rPassStrength");

function setRegistrationFieldError(input, message) {
  if (!input) return;

  const errorId = `${input.id}Error`;
  let error = document.getElementById(errorId);

  if (!message) {
    error?.remove();
    input.removeAttribute("aria-invalid");
    input.removeAttribute("aria-describedby");
    return;
  }

  if (!error) {
    error = document.createElement("small");
    error.className = "field-error";
    error.id = errorId;
    error.setAttribute("aria-live", "polite");

    if (input.type === "checkbox") {
      input.closest("label")?.after(error);
    } else if (input.id === "rPass" && passwordStrength) {
      passwordStrength.after(error);
    } else {
      input.after(error);
    }
  }

  error.textContent = message;
  input.setAttribute("aria-invalid", "true");
  input.setAttribute("aria-describedby", errorId);
}

function registrationFieldMessage(input) {
  if (!input) return "";

  switch (input.id) {
    case "rName":
      return input.value.trim()
        ? ""
        : "Enter your name or business name.";

    case "rEmail":
      if (!input.value.trim()) {
        return "Enter your email address.";
      }

      return input.validity.valid
        ? ""
        : "Enter a valid email address.";

    case "rPhone":
      if (!input.value.trim()) {
        return "Enter your phone number.";
      }

      return /^[6-9]\d{9}$/.test(input.value.trim())
        ? ""
        : "Enter 10 digits starting with 6.";

    case "rCity":
      return input.value.trim()
        ? ""
        : "Enter your city or area.";

    case "rPass": {
      const password = input.value;

      if (password.length < 8) {
        return "Use at least 8 characters.";
      }

      if (!/[A-Z]/.test(password)) {
        return "Add an uppercase letter (A-Z).";
      }

      if (!/[a-z]/.test(password)) {
        return "Add a lowercase letter (a-z).";
      }

      if (!/[0-9]/.test(password)) {
        return "Add a number (0-9).";
      }

      if (!/[^A-Za-z0-9\s]/.test(password)) {
        return "Add a special character.";
      }

      return "";
    }

    case "rPass2":
      if (!input.value) {
        return "";
      }

      return input.value === registrationPassword?.value
        ? ""
        : "Passwords do not match.";

    case "rTerms":
      return input.checked
        ? ""
        : "Accept the food safety terms to continue.";

    default:
      return "";
  }
}

function validateRegistrationField(input) {
  const message = registrationFieldMessage(input);
  setRegistrationFieldError(input, message);
  return !message;
}

function updatePasswordStrength() {
  if (!registrationPassword || !passwordStrength) return;

  const value = registrationPassword.value;

  const valid =
    value.length >= 8 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[^A-Za-z0-9\s]/.test(value);

  passwordStrength.textContent = valid ? "Strong password" : "";
  passwordStrength.dataset.strength = valid ? "strong" : "";
}

if (registerForm) {
  const registrationFields = [
    $("#rName"),
    $("#rEmail"),
    $("#rPhone"),
    $("#rCity"),
    registrationPassword,
    $("#rPass2"),
    $("#rTerms"),
  ].filter(Boolean);

  registrationFields.forEach((input) => {
    const eventName = input.type === "checkbox" ? "change" : "input";

    input.addEventListener(eventName, () => {
      validateRegistrationField(input);

      if (registerMessage) {
        registerMessage.style.display = "none";
      }

      if (input === registrationPassword) {
        updatePasswordStrength();

        const confirmPassword = $("#rPass2");

        if (confirmPassword?.value) {
          validateRegistrationField(confirmPassword);
        }
      }
    });

    input.addEventListener("blur", () => {
      validateRegistrationField(input);
    });

    if (input === registrationPassword) {
      input.addEventListener("focus", () => {
        validateRegistrationField(input);
      });
    }
  });

  updatePasswordStrength();

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = $("#rName")?.value.trim();
    const email = $("#rEmail")?.value.trim().toLowerCase();
    const phone = $("#rPhone")?.value.trim();
    const city = $("#rCity")?.value.trim();
    const registrationNumber = $("#rReg")?.value.trim();
    const password = $("#rPass")?.value;
    const confirmPassword = $("#rPass2")?.value;

    const selectedRole = document.querySelector(
      'input[name="rrole"]:checked'
    );

    const accountType = $("#rType")?.value;
    const termsAccepted = $("#rTerms")?.checked;

    const invalidFields = registrationFields.filter(
      (input) => !validateRegistrationField(input)
    );

    if (
      invalidFields.length ||
      !selectedRole ||
      !name ||
      !email ||
      !phone ||
      !city ||
      !password ||
      !confirmPassword ||
      !termsAccepted
    ) {
      invalidFields[0]?.focus();
      return;
    }

    const submitButton = registerForm.querySelector(
      'button[type="submit"]'
    );

    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      const role =
        selectedRole.value === "recipient"
          ? "organisation"
          : selectedRole.value;

      const result = await apiRequest("register.php", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          phone,
          city,
          registration_number: registrationNumber || null,
          password,
          role,
          account_type: accountType || null,
        }),
      });

      if (registerMessage) {
        msg(
          registerMessage,
          result.message || "Registration successful! You can now log in.",
          false
        );
      }

      registerForm.reset();
      updateRegistrationFields();

      registrationFields.forEach((input) =>
        setRegistrationFieldError(input, "")
      );

      updatePasswordStrength();

      window.setTimeout(() => {
        window.location.href = "login.html";
      }, 1200);
    } catch (error) {
      if (registerMessage) {
        msg(
          registerMessage,
          error.message || "Registration failed. Please try again.",
          true
        );
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
}

/*
 * Show or hide the registration-number field based on account type.
 */
function updateRegistrationFields() {
  const accountType = $("#rType");
  const registrationWrap = $("#rRegWrap");

  if (!accountType || !registrationWrap) return;

  const selectedType = accountType.value.toLowerCase();

  const requiresRegistration = [
    "hotel",
    "restaurant",
    "caterer",
    "organisation",
    "organization",
  ].includes(selectedType);

  registrationWrap.hidden = !requiresRegistration;
}

const accountTypeSelect = $("#rType");

if (accountTypeSelect) {
  accountTypeSelect.addEventListener("change", updateRegistrationFields);
  updateRegistrationFields();
}
