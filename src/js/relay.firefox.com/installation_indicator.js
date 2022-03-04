// This looks for <firefox-private-relay-addon></firefox-private-relay-addon> and
// updates the dataset. The Private Relay website watches for this change, and
// makes content changes if the addon has been installed.

(async () => {
  localStorage.setItem("fxRelayAddonInstalled", "true");
  document.querySelectorAll("firefox-private-relay-addon").forEach(async (el) => {
    el.dataset.addonInstalled = "true";

    // In the server-rendered version of the website, the add-on would store alias labels
    // locally if server-side storage was disabled.
    // In the React version of the website, the website handles local storage itself.
    // However, to allow for seamless migration, this injects the labels stored in the add-on
    // into the website, so that it can copy those into its own storage.
    const localRandomAliasCache = (await browser.storage.local.get("relayAddresses")).relayAddresses;
    if (Array.isArray(localRandomAliasCache)) {
      const localLabels = localRandomAliasCache
        .filter(address => address.description.length > 0)
        .map(address => ({
          type: "random",
          id: Number.parseInt(address.id, 10),
          description: address.description,
          generated_for: address.generated_for,
          address: address.address,
        })
      );
      el.dataset.localLabels = JSON.stringify(localLabels);
    }
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
