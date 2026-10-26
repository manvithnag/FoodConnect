/*
 * FoodConnect - Dashboard
 * Donor can add food listings.
 * Organisation can view available food and request it.
 */

const dashboardBody = $("#dashBody");

async function loadDashboard() {
  if (!dashboardBody) return;

  dashboardBody.textContent = "Loading your dashboard...";

  try {
    const result = await apiRequest("dashboard.php");
    const user = result.user || {};
    const role = user.role || "";

    dashboardBody.replaceChildren();

    const heading = document.createElement("h1");
    heading.textContent = `Welcome, ${user.name || "User"}!`;
    dashboardBody.appendChild(heading);

    const description = document.createElement("p");
    description.textContent = `Account type: ${role}`;
    dashboardBody.appendChild(description);

    if (role === "donor") {
      renderDonorOverview(
        result.donor_stats || {},
        result.donation_history || [],
      );
      renderDonorListingsLink();
      renderDonorForm();
      renderDonorCertificate(
        user.name || "FoodConnect Donor",
        result.donor_category || "Bronze Giver",
      );
    } else if (role === "organisation") {
      renderOrganisationDashboard();
    } else {
      const message = document.createElement("p");
      message.textContent =
        "Your account does not have a supported dashboard role.";
      dashboardBody.appendChild(message);
    }
  } catch (error) {
    dashboardBody.replaceChildren();

    const heading = document.createElement("h2");
    heading.textContent = "Dashboard unavailable";

    const message = document.createElement("p");
    message.textContent = error.message || "Please log in and try again.";

    const loginLink = document.createElement("a");
    loginLink.href = "login.html";
    loginLink.textContent = "Go to Login";
    loginLink.className = "btn";

    dashboardBody.append(heading, message, loginLink);
  }
}

function renderDonorOverview(stats, history) {
  const statsSection = document.createElement("section");
  statsSection.className = "card dash-panel";
  const statsHeading = document.createElement("h2");
  statsHeading.textContent = "Your Donation Statistics";
  const statsTable = document.createElement("table");
  const statsHead = document.createElement("thead");
  const statsHeadRow = document.createElement("tr");
  ["Donation statistic", "Value"].forEach((label) => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = label;
    statsHeadRow.appendChild(cell);
  });
  statsHead.appendChild(statsHeadRow);
  const statsBody = document.createElement("tbody");
  [
    ["Total donations", Number(stats.total_donations) || 0],
    [
      "Donor rank",
      stats.donor_rank ? `#${stats.donor_rank}` : "Not ranked yet",
    ],
  ].forEach(([label, value]) => {
    const row = document.createElement("tr");
    const labelCell = document.createElement("td");
    const valueCell = document.createElement("td");
    labelCell.textContent = label;
    valueCell.textContent = String(value);
    row.append(labelCell, valueCell);
    statsBody.appendChild(row);
  });
  statsTable.append(statsHead, statsBody);
  statsSection.append(statsHeading, statsTable);

  const historySection = document.createElement("section");
  historySection.className = "card dash-panel";
  const historyHeading = document.createElement("h2");
  historyHeading.textContent = "Donation History";
  const historyDescription = document.createElement("p");
  historyDescription.textContent =
    "All food listings you have added and their current status.";
  const historyTable = document.createElement("table");
  const historyHead = document.createElement("thead");
  const historyHeadRow = document.createElement("tr");
  ["Food donation", "Date added", "Status"].forEach((label) => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = label;
    historyHeadRow.appendChild(cell);
  });
  historyHead.appendChild(historyHeadRow);
  const historyBody = document.createElement("tbody");

  if (history.length) {
    history.forEach((donation) => {
      const row = document.createElement("tr");
      const foodCell = document.createElement("td");
      const dateCell = document.createElement("td");
      const statusCell = document.createElement("td");
      foodCell.textContent = donation.title || "Food listing";
      const date = donation.created_at
        ? new Date(String(donation.created_at).replace(" ", "T"))
        : null;
      dateCell.textContent =
        date && !Number.isNaN(date.getTime())
          ? new Intl.DateTimeFormat(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            }).format(date)
          : "Date unavailable";
      const status = donation.donation_completed
        ? "Completed"
        : String(donation.status || "Available");
      statusCell.textContent = status.charAt(0).toUpperCase() + status.slice(1);
      row.append(foodCell, dateCell, statusCell);
      historyBody.appendChild(row);
    });
  } else {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.textContent = "You have not added any food listings yet.";
    row.appendChild(cell);
    historyBody.appendChild(row);
  }

  historyTable.append(historyHead, historyBody);
  const tableWrap = document.createElement("div");
  tableWrap.className = "dashboard-table-wrap";
  tableWrap.appendChild(historyTable);
  historySection.append(historyHeading, historyDescription, tableWrap);
  dashboardBody.append(statsSection, historySection);
}
function renderDonorListingsLink() {
  const section = document.createElement("section");
  section.className = "card dash-panel";

  const heading = document.createElement("h2");
  heading.textContent = "Add Food Listing";

  const description = document.createElement("p");
  description.textContent = "Go to the form to publish a food donation.";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn dk";
  button.textContent = "Add Food Listing";
  button.addEventListener("click", () => {
    const formSection = document.getElementById("addFoodSection");
    if (!formSection) return;
    formSection.hidden = false;
    formSection.scrollIntoView({ behavior: "smooth", block: "start" });
    formSection.querySelector("input")?.focus({ preventScroll: true });
  });

  section.append(heading, description, button);
  dashboardBody.appendChild(section);
}
function renderDonorCertificate(donorName, donorCategory) {
  const section = document.createElement("section");
  section.className = "card certificate-panel";

  const heading = document.createElement("h2");
  heading.textContent = "Your certificate of appreciation";

  const description = document.createElement("p");
  description.textContent =
    "Celebrate your commitment to sharing good food and reducing waste.";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn dk";
  button.textContent = "Download certificate";
  button.addEventListener("click", () => {
    const certificateWindow = window.open("", "_blank", "width=900,height=680");
    if (!certificateWindow) return;

    const logoUrl = new URL("../assets/images/logo.png", window.location.href)
      .href;
    const safeName = esc(donorName);
    const safeCategory = esc(donorCategory);
    const issueDate = new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date());

    certificateWindow.document.write(`<!DOCTYPE html>
      <html lang="en"><head><meta charset="UTF-8"><title>FoodConnect Certificate</title>
      <style>
        *{box-sizing:border-box}body{margin:0;padding:20px;background:#f3f6f1;color:#183b31;font-family:Arial,sans-serif}
        .certificate{max-width:760px;margin:auto;padding:26px 30px;text-align:center;background:#fffdf7;border:7px double #c9973d;outline:1px solid #16473a;outline-offset:-17px}
        img{width:64px;height:64px;object-fit:contain}.brand{margin:5px 0 12px;color:#16473a;font-size:16px;font-weight:bold;letter-spacing:2px;text-transform:uppercase}
        h1{margin:8px 0;color:#16473a;font-family:Georgia,serif;font-size:38px}.rule{width:100px;height:3px;margin:12px auto;background:#d4a84c}
        .intro{margin:16px 0 8px;color:#5d6b66;font-size:16px}.name{margin:8px 0;color:#9b6d1b;font-family:Georgia,serif;font-size:32px}
        .copy{max-width:620px;margin:0 auto;color:#344b43;font-size:16px;line-height:1.5}.date{margin:20px 0 0;color:#5d6b66;font-size:13px}
        @media print{@page{size:landscape;margin:10mm}body{padding:0;background:#fff}.certificate{max-width:none;padding:24px 28px}}
      </style></head><body><main class="certificate"><img src="${logoUrl}" alt="FoodConnect logo">
      <div class="brand">FoodConnect</div><h1>Certificate of Appreciation</h1><div class="rule"></div>
      <p class="intro">Presented with gratitude to</p><h2 class="name">${safeName}</h2>
      <p class="copy">In recognition of your generosity as a <strong>${safeCategory}</strong>. Thank you for helping good food reach people who need it and making a meaningful difference in the FoodConnect community.</p>
      <p class="date">Issued ${issueDate}</p></main><script>window.onload=()=>window.print()<\/script></body></html>`);
    certificateWindow.document.close();
  });

  section.append(heading, description, button);
  dashboardBody.appendChild(section);
}

function renderDonorForm() {
  const section = document.createElement("section");
  section.className = "card";
  section.id = "addFoodSection";
  section.hidden = true;

  const heading = document.createElement("h2");
  heading.textContent = "Add Food Listing";

  const form = document.createElement("form");
  form.id = "addFoodForm";

  const fields = [
    { name: "title", label: "Food name", type: "text", required: true },
    { name: "description", label: "Description", type: "textarea" },
    { name: "kind", label: "Food category", type: "text" },
    { name: "qty", label: "Quantity / servings", type: "text", required: true },
    { name: "addr", label: "Pickup address", type: "text", required: true },
    {
      name: "collect_before",
      label: "Collect before",
      type: "datetime-local",
      required: true,
    },
  ];

  fields.forEach((field) => {
    const label = document.createElement("label");
    label.textContent = field.label;
    label.style.display = "block";
    label.style.marginBottom = "12px";

    const input = document.createElement(
      field.type === "textarea" ? "textarea" : "input",
    );

    if (field.type !== "textarea") {
      input.type = field.type;
    }

    input.name = field.name;
    input.required = Boolean(field.required);
    input.style.display = "block";
    input.style.width = "100%";
    input.style.marginTop = "6px";
    input.style.padding = "10px";

    if (field.name === "collect_before") {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      input.min = now.toISOString().slice(0, 16);
    }

    label.appendChild(input);
    form.appendChild(label);
  });

  const message = document.createElement("p");
  message.id = "addFoodMessage";
  message.setAttribute("role", "status");

  const button = document.createElement("button");
  button.type = "submit";
  button.className = "btn dk";
  button.textContent = "Publish Food Listing";

  form.append(button, message);
  section.append(heading, form);
  dashboardBody.appendChild(section);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = form.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(form).entries());

    const deadline = new Date(data.collect_before);

    if (Number.isNaN(deadline.getTime()) || deadline <= new Date()) {
      message.textContent = "Please select a future collection date and time.";
      return;
    }

    submitButton.disabled = true;
    message.textContent = "Publishing food listing...";

    try {
      const response = await apiRequest("listings.php", {
        method: "POST",
        body: JSON.stringify(data),
      });

      message.textContent =
        response.message || "Food listing published successfully!";

      form.reset();
    } catch (error) {
      message.textContent =
        error.message || "Could not publish the food listing.";
    } finally {
      submitButton.disabled = false;
    }
  });
}

function renderOrganisationDashboard() {
  const section = document.createElement("section");
  section.className = "card";

  const heading = document.createElement("h2");
  heading.textContent = "Find Available Food";

  const description = document.createElement("p");
  description.textContent =
    "Browse food available for collection and submit a request.";

  const link = document.createElement("a");
  link.href = "#addFoodForm";
  link.className = "btn dk";
  link.textContent = "Browse Food Listings";

  section.append(heading, description, link);
  dashboardBody.appendChild(section);
}

document.addEventListener("DOMContentLoaded", loadDashboard);
