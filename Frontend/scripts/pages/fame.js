/*
 * FoodConnect - Hall of Fame
 * Shows donors ranked by completed meals served.
 */

const fameList = $("#fameList");

function addFameMessage(message) {
  const item = document.createElement("li");
  item.className = "fame-empty";
  item.textContent = message;
  item.setAttribute("role", "status");
  fameList.replaceChildren(item);
}

function renderDonor(person, index) {
  const item = document.createElement("li");
  item.className = "fame-row";

  const rank = document.createElement("span");
  rank.className = "fame-rank";
  rank.textContent = `#${Number(person.rank) || index + 1}`;

  const details = document.createElement("div");
  details.className = "fame-details";

  const name = document.createElement("h4");
  name.className = "fame-name";
  name.textContent = person.name || "Community Donor";

  const stats = document.createElement("p");
  stats.className = "fame-stats";

  const donations = Number(person.completed_donations) || 0;
  const donationStat = document.createElement("span");
  donationStat.textContent = `${donations.toLocaleString()} completed ${donations === 1 ? "donation" : "donations"}`;

  const meals = Number(person.meals_served) || 0;
  const mealsStat = document.createElement("span");
  mealsStat.textContent = person.meals_recorded
    ? `${meals.toLocaleString()} meals served`
    : "Meal count not recorded";

  stats.append(donationStat, mealsStat);
  details.append(name, stats);

  const badge = document.createElement("span");
  const categoryKey = String(person.category_key || "bronze").toLowerCase();
  badge.className = `badge fame-badge ${categoryKey}`;
  badge.textContent = person.category || "Bronze Giver";

  item.append(rank, details, badge);
  return item;
}

async function loadHallOfFame() {
  if (!fameList) return;

  fameList.setAttribute("aria-busy", "true");
  addFameMessage("Loading donor rankings…");

  try {
    const result = await getHallOfFame();
    const contributors = Array.isArray(result)
      ? result
      : result.contributors || [];

    if (contributors.length === 0) {
      addFameMessage("No completed donor donations yet.");
      return;
    }

    fameList.replaceChildren(
      ...contributors.map((person, index) => renderDonor(person, index)),
    );
  } catch (error) {
    addFameMessage(error.message || "Unable to load donor rankings.");
  } finally {
    fameList.setAttribute("aria-busy", "false");
  }
}

document.addEventListener("DOMContentLoaded", loadHallOfFame);
