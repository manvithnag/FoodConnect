/*
 * FoodConnect - Accessible Navigation
 * Handles navigation, login state, profile, logout and mobile menu.
 */

const navigationPages = [
  { label: "Home", page: "home" },
  { label: "Who can take part", page: "domains" },
  { label: "Food safety guide", page: "guide" },
  { label: "Hall of Fame", page: "fame" },
  { label: "Available food", page: "listings" },
  { label: "Log in", page: "login", guestOnly: true },
  { label: "Register", page: "register", guestOnly: true },
  { label: "Profile", page: "dashboard", loggedInOnly: true }
];

function go(page) {
  const allowedPages = navigationPages.map((item) => item.page);

  if (!allowedPages.includes(page)) return;

  window.location.href = `${page}.html`;
}

async function renderNavigation() {
  const nav = document.querySelector("#nav");
  const header = document.querySelector("header");

  if (!nav || !header) return;

  let user = null;

  try {
    const result = await apiRequest("current-user.php");
    user = result.user || null;
  } catch (error) {
    user = null;
  }

  const loggedIn = Boolean(user);
  const currentPage = document.body.dataset.page;

  const links = navigationPages.filter((item) => {
    if (item.guestOnly && loggedIn) return false;
    if (item.loggedInOnly && !loggedIn) return false;
    return true;
  });

  nav.innerHTML = links.map((item) => {
    const active =
      item.page === currentPage ||
      (item.page === "dashboard" && currentPage === "dash");

    return `
      <a
        href="${item.page}.html"
        class="${item.page === "dashboard" ? "profile-menu-link" : ""}"
        ${active ? 'aria-current="page"' : ""}
      >${item.label}</a>
    `;
  }).join("");

  // Remove any previously created profile icons.
  header.querySelectorAll(".profile-icon-link").forEach((icon) => {
    icon.remove();
  });

  if (loggedIn) {
    const profileLink = document.createElement("a");

    profileLink.href = "dashboard.html";
    profileLink.className = "profile-icon-link";
    profileLink.setAttribute("aria-label", "Open profile");
    profileLink.setAttribute("title", "Profile");

    profileLink.innerHTML = `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="8" r="3.5"></circle>
        <path d="M5 20a7 7 0 0 1 14 0"></path>
      </svg>
    `;

    const logoutButton = document.createElement("button");

    logoutButton.type = "button";
    logoutButton.className = "logout-btn";
    logoutButton.textContent = "Logout";

    logoutButton.addEventListener("click", async () => {
      logoutButton.disabled = true;
      logoutButton.textContent = "Logging out...";

      try {
        await apiRequest("logout.php", {
          method: "POST",
          body: JSON.stringify({})
        });

        window.location.href = "home.html";
      } catch (error) {
        logoutButton.disabled = false;
        logoutButton.textContent = "Logout";

        alert(error.message || "Logout failed. Please try again.");
      }
    });

    // Place Profile immediately after Available Food.
    const availableFoodLink = [
      ...nav.querySelectorAll("a")
    ].find((link) => link.getAttribute("href") === "listings.html");

    if (availableFoodLink) {
      availableFoodLink.insertAdjacentElement("afterend", profileLink);
    } else {
      nav.appendChild(profileLink);
    }

    // Keep Logout as the last navigation item.
    nav.appendChild(logoutButton);
  }

  // Handle navigation links only. The homepage CTA is handled separately.
  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", (event) => {
      const isAvailableFood =
        link.getAttribute("href") === "listings.html";

      if (isAvailableFood && !loggedIn) {
        event.preventDefault();

        toggleMenu(false);

        if (currentPage === "home") {
          if (typeof window.openWelcome === "function") {
            window.openWelcome();
          } else {
            window.location.href = "login.html";
          }
        } else {
          window.location.href = "home.html";
        }

        return;
      }

      // Close the mobile menu after selecting a link.
      toggleMenu(false);
    });
  });
}

// Toggle the mobile menu and update its accessible state.
function toggleMenu(forceState) {
  const nav = document.querySelector("#nav");
  const backdrop = document.querySelector("#backdrop");
  const burger = document.querySelector("#burger");

  if (!nav) return;

  const wasOpen = nav.classList.contains("open");

  const shouldOpen =
    typeof forceState === "boolean"
      ? forceState
      : !wasOpen;

  nav.classList.toggle("open", shouldOpen);

  if (backdrop) {
    backdrop.classList.toggle("show", shouldOpen);
    backdrop.setAttribute("aria-hidden", String(!shouldOpen));
  }

  if (burger) {
    burger.setAttribute("aria-expanded", String(shouldOpen));
    burger.setAttribute(
      "aria-label",
      shouldOpen ? "Close navigation menu" : "Open navigation menu"
    );

    burger.innerHTML = shouldOpen
      ? `
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M18 6 6 18"></path>
          <path d="m6 6 12 12"></path>
        </svg>
      `
      : `
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M4 6h16"></path>
          <path d="M4 12h16"></path>
          <path d="M4 18h16"></path>
        </svg>
      `;

    // Restore focus when closing an open mobile menu.
    if (
      wasOpen &&
      !shouldOpen &&
      window.matchMedia("(max-width: 800px)").matches
    ) {
      burger.focus();
    }
  }
}

document.addEventListener("DOMContentLoaded", renderNavigation);

// Escape closes the mobile menu.
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;

  const nav = document.querySelector("#nav");

  if (nav?.classList.contains("open")) {
    event.preventDefault();
    toggleMenu(false);
  }
});