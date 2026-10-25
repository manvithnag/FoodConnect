
/*
 * FoodConnect - Home Page
 * Loads impact statistics and handles homepage-specific access.
 */

// Load homepage impact statistics.
async function loadHomeStats() {
  const statElements = {
    meals: document.querySelector("#sMeals"),
    donations: document.querySelector("#sDon"),
    donors: document.querySelector("#sDonors"),
    organisations: document.querySelector("#sOrgs"),
  };

  const elements = Object.values(statElements).filter(Boolean);

  if (elements.length === 0) return;

  elements.forEach((element) => {
    element.textContent = "—";
  });

  try {
    const result = await apiRequest("stats.php");
    const stats = result.stats || result;

    if (statElements.meals) {
      statElements.meals.textContent =
        (Number(stats.total_meals) || 0).toLocaleString();
    }

    if (statElements.donations) {
      statElements.donations.textContent =
        (Number(stats.total_donations) || 0).toLocaleString();
    }

    if (statElements.donors) {
      statElements.donors.textContent =
        (Number(stats.total_donors) || 0).toLocaleString();
    }

    if (statElements.organisations) {
      statElements.organisations.textContent =
        (Number(stats.total_organisations) || 0).toLocaleString();
    }
  } catch (error) {
    console.error("Unable to load FoodConnect statistics:", error);
  }
}

// Get the currently logged-in user.
async function getHomeUser() {
  try {
    const result = await getCurrentUser();
    return result?.user || null;
  } catch (error) {
    return null;
  }
}

// Hide Available Food links for donors on the homepage.
async function setupHomeAccess() {
  const user = await getHomeUser();

  if (user?.role === "donor") {
    document
      .querySelectorAll('a[href="listings.html"]')
      .forEach((link) => {
        link.hidden = true;
      });
  }
}

// Initialize homepage features.
document.addEventListener("DOMContentLoaded", () => {
  console.log("Home page initialized");
  loadHomeStats();
  setupHomeAccess();
});
