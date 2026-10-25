/*
 * FoodConnect - Keyboard Shortcuts
 *
 * Z          = Zoom in
 * X          = Zoom out
 * R          = Reset zoom
 * Alt + H    = Home page
 * Alt + L    = Login page
 * Alt + G    = Register page
 * Escape     = Close welcome popup
 */

(() => {
  let zoomLevel = 100;

  const MIN_ZOOM = 80;
  const MAX_ZOOM = 150;
  const ZOOM_STEP = 10;

  function applyZoom() {
    document.documentElement.style.zoom = `${zoomLevel}%`;
  }

  function navigateTo(page) {
    window.location.href = page;
  }

  document.addEventListener("keydown", (event) => {
    const target = event.target;

    // Do not interfere with typing or editing.
    if (
      target instanceof HTMLElement &&
      (
        target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      )
    ) {
      return;
    }

    // Home, Login and Register shortcuts.
    if (event.altKey && !event.ctrlKey && !event.metaKey) {
      switch (event.key.toLowerCase()) {
        case "h":
          event.preventDefault();
          navigateTo("home.html");
          return;

        case "l":
          event.preventDefault();
          navigateTo("login.html");
          return;

        case "g":
          event.preventDefault();
          navigateTo("register.html");
          return;
      }
    }

    // Do not interfere with browser and OS shortcuts.
    if (event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }

    switch (event.key.toLowerCase()) {
      case "z":
        event.preventDefault();
        zoomLevel = Math.min(zoomLevel + ZOOM_STEP, MAX_ZOOM);
        applyZoom();
        break;

      case "x":
        event.preventDefault();
        zoomLevel = Math.max(zoomLevel - ZOOM_STEP, MIN_ZOOM);
        applyZoom();
        break;

      case "r":
        event.preventDefault();
        zoomLevel = 100;
        applyZoom();
        break;

      case "escape": {
        const modal = document.getElementById("welcome");

        if (modal && !modal.hidden) {
          if (typeof window.closeWelcome === "function") {
            window.closeWelcome();
          }
        }

        break;
      }
    }
  });
})();
