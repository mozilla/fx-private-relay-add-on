// This looks for <firefox-private-relay-addon></firefox-private-relay-addon> and
// updates the dataset. The Private Relay website watches for this change, and
// makes content changes if the addon has been installed.

(async () => {
  localStorage.setItem("fxRelayAddonInstalled", "true");
  document.querySelectorAll("firefox-private-relay-addon").forEach(async (el) => {
    el.dataset.addonInstalled = "true";

    // If server-side storage of label data is disabled, they can still be
    // stored locally by the add-on. Here, we inject those into the website,
    // so that it can display them in the label editor:
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
})();
