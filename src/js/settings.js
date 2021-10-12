(function () {
  "use strict";

  // If user updates server storage pref, refresh any open /account/* pages
  browser.runtime.onMessage.addListener((message, sender, response) => {
    if (message.message === "refreshSettingsPage") {
      document.location.reload(true);
    }
  });
  
})();
