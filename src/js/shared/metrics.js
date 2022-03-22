"use strict";

/* exported sendRelayEvent */

// eslint-disable-next-line no-redeclare
async function sendRelayEvent(eventCategory, eventAction, eventLabel) {
  const browserVendor = browser.menus ? "Firefox" : "Chrome";
  return await browser.runtime.sendMessage({
    method: "sendMetricsEvent",
    eventData: {
      category: `Extension: ${eventCategory}`,
      action: eventAction,
      label: eventLabel,
      dimension5: browserVendor
    },
  });
}
