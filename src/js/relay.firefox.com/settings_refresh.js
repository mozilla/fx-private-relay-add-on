(async function () {
  document.querySelector(
    "firefox-private-relay-addon"
  )?.addEventListener("website", async (event) => {
    if (event.detail.type === "serverStorageChange") {
      // Reload all website pages, so that they can adjust to the user's new
      // settings, i.e. to ensure that label changes are no longer sent to the
      // server if server label storage is disabled, or vice versa,
      // and that the add-on can re-initialise w.r.t. the data it injects and
      // listens for in the website:
      browser.runtime.sendMessage({
        method: "refreshAccountPages",
      });
    }
  });
})();
