/*
 * FoodConnect - Common Helpers
 * Shared utility functions for frontend JavaScript.
 */

// Select one element from the page.
const $ = (selector) => document.querySelector(selector);

// Escape text before inserting it into HTML.
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );

// Find a user in an explicitly provided list.
// Does not depend on an undefined global "users" variable.
function uid(id, userList = []) {
  return (
    userList.find((user) => user.id === id) || {
      name: "Unknown",
    }
  );
}

// Display a message in an existing HTML element.
function msg(element, text, isError = false) {
  if (!element) return;

  element.textContent = text;
  element.className = isError ? "msg error" : "msg";
  element.style.display = "block";
}
