// This looks for <firefox-private-relay-addon></firefox-private-relay-addon> and
// updates the dataset. The Private Relay website watches for this change, and
// makes content changes if the addon has been installed.

(async () => {
  localStorage.setItem("fxRelayAddonInstalled", "true");
  document.querySelectorAll("firefox-private-relay-addon").forEach((el) => {
    el.dataset.addonInstalled = "true";
  });

  // Check for <firefox-private-relay-addon>
  const addonDataElement = document.querySelector(
    "firefox-private-relay-addon"
  );
  if (addonDataElement) {
    // Query if the user is logged in or out
    const isLoggedIn = document.querySelector("firefox-private-relay-addon")
      .dataset.userLoggedIn;

    if (isLoggedIn !== undefined) {
      // As long as we get a non-undefined state, we pass it to the background script
      await browser.runtime.sendMessage({
        method: "updateAddOnAuthStatus",
        status: isLoggedIn,
      });
    }
  }
})();
