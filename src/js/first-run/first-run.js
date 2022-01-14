"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const { relaySiteOrigin } = await browser.storage.local.get("relaySiteOrigin");

  // Set custom fonts from the add-on
  await setCustomFonts();

  document.addEventListener("focus", () => {
    enableDataOptOut();
  });

  enableDataOptOut();

  const oauthEntryPoints = document.querySelectorAll(".open-oauth");
  oauthEntryPoints.forEach(el => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      sendRelayEvent("First Run", "click", e.target.dataset.eventLabel);
      return window.open(`${relaySiteOrigin}/accounts/profile?utm_source=fx-relay-addon&utm_medium=first-run&utm_content=first-run-sign-up-btn`);
    });
  });

});
