/*
 * FoodConnect - Available Food Listings
 * Loads food listings from the PHP backend.
 */

const listingsGrid = $("#listGrid");
const listingsMessage = $("#lmsg");
let showRequestButtons = true;

async function renderListings() {
  if (!listingsGrid) return;

  try {
    const session = await apiRequest("current-user.php");
    showRequestButtons = session.user?.role !== "donor";
  } catch (error) {
    showRequestButtons = true;
  }

  listingsGrid.replaceChildren();

  if (listingsMessage) {
    listingsMessage.textContent = "Loading available food...";
    listingsMessage.style.display = "block";
    listingsMessage.className = "msg";
  }

  try {
    const result = await getFoodListings();
    const listings = Array.isArray(result) ? result : result.listings || [];

    if (listingsMessage) {
      listingsMessage.style.display = "none";
    }

    if (listings.length === 0) {
      listingsGrid.innerHTML =
        '<div class="card"><p>No food is listed right now. Please check back soon.</p></div>';
      return;
    }

    listingsGrid.innerHTML = listings
      .map((food) => {
        const id = Number(food.id);
        const title = esc(food.title || food.food_name || "Food listing");
        const kind = esc(food.kind || food.category || "Food");
        const quantity = esc(food.qty ?? food.quantity ?? "Not specified");
        const address = esc(food.addr || food.location || "Not specified");
        const collectionTime = esc(
          food.by || food.collect_before || "Not specified",
        );
        const donorName = esc(food.donor_name || "FoodConnect donor");

        return `
        <article class="card">
          <span class="tag">${kind}</span>
          <span class="tag amb">Serves ${quantity}</span>
          <h3>${title}</h3>
          <p>By <b>${donorName}</b></p>
          <p>📍 ${address}</p>
          <p>⏰ Collect before: ${collectionTime}</p>
          ${
            showRequestButtons
              ? (() => {
                  // The listings API should return one of these fields for the
                  // logged-in organisation to persist the button state on reload.
                  const alreadyRequested =
                    food.requested_by_me === true ||
                    food.is_requested === true ||
                    ["pending", "approved", "completed"].includes(
                      String(food.my_request_status || food.request_status || "").toLowerCase()
                    );
                  const validId = Number.isSafeInteger(id) && id > 0;
                  return `<p style="margin-top:12px">
                    <button
                      class="btn dk sm"
                      type="button"
                      data-food-id="${validId ? id : ""}"
                      ${!validId || alreadyRequested ? "disabled" : ""}
                      ${alreadyRequested ? 'data-requested="true"' : ""}>
                      ${alreadyRequested ? "Requested" : "Request this food"}
                    </button>
                  </p>`;
                })()
              : ""
          }
        </article>
      `;
      })
      .join("");
  } catch (error) {
    if (listingsMessage) {
      listingsMessage.textContent =
        error.message || "Unable to load food listings. Please try again.";
      listingsMessage.style.display = "block";
      listingsMessage.className = "msg err";
    }
  }
}

if (listingsGrid) {
  listingsGrid.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-food-id]");
    if (!button || button.disabled) return;

    const foodId = Number(button.dataset.foodId);

    if (!Number.isSafeInteger(foodId) || foodId <= 0) return;

    button.disabled = true;

    try {
      await apiRequest("requests.php", {
        method: "POST",
        body: JSON.stringify({ food_id: foodId }),
      });

      // Keep the button disabled after a successful request to prevent duplicates.
      button.textContent = "Requested";
      button.disabled = true;
      button.dataset.requested = "true";

      if (listingsMessage) {
        listingsMessage.textContent = "Food request submitted successfully.";
        listingsMessage.style.display = "block";
        listingsMessage.className = "msg";
      }
    } catch (error) {
      // If the backend says the organisation already requested this listing,
      // reflect that state rather than allowing another click.
      const errorMessage = error.message || "Unable to submit your request. Please log in and try again.";
      if (/already requested|already request|duplicate/i.test(errorMessage)) {
        button.textContent = "Requested";
        button.disabled = true;
        button.dataset.requested = "true";
      } else {
        button.disabled = false;
      }

      if (listingsMessage) {
        listingsMessage.textContent = errorMessage;
        listingsMessage.style.display = "block";
        listingsMessage.className = "msg err";
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", renderListings);
s