"use strict";

/* exported sendRelayEvent */

// eslint-disable-next-line no-redeclare
async function sendRelayEvent(eventCategory, eventAction, eventLabel) {
  // "dimension5" is a Google Analytics-specific variable to track a custom dimension. 
  // This dimension is used to determine which browser vendor the add-on is using: Firefox or Chrome
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
