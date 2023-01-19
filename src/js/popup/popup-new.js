const popup = {
  events: {
    navigationClick: (e) => {
      e.preventDefault();
      const panelId = e.target.dataset.panelId;
      popup.events.updatePanel(panelId);
    },
    updatePanel: (panelId) => {
      const panels = document.querySelectorAll(".panel");
      panels.forEach((panel) => {
        panel.classList.add("is-hidden");

        if (panel.dataset.panelId === panelId) {
          panel.classList.remove("is-hidden");
          // TODO: initPanel(panelId);
        }
      });
    },
  },
  init: async () => {
    // Set Navigation Listeners
    const navigationButtons = document.querySelectorAll(".js-internal-link");

    navigationButtons.forEach((button) => {
      button.addEventListener("click", popup.events.navigationClick, false);
    });

    // Check if user is signed in to show default/sign-in panel
    if (await popup.utilities.isUserSignedIn()) {
      popup.events.updatePanel("masks");
    } else {
       popup.events.updatePanel("sign-up"); 
    }
  },
  utilities: {
    isUserSignedIn: async ()=> {
        const userApiToken = await browser.storage.local.get("apiToken");
        const signedInUser = (Object.prototype.hasOwnProperty.call(userApiToken, "apiToken"));
        return (signedInUser);
    },
    clearBrowserActionBadge: async() => {
        const { browserActionBadgesClicked } = await browser.storage.local.get(
          "browserActionBadgesClicked"
        );

        // Dismiss the browserActionBadge only when it exists
        if (browserActionBadgesClicked === false) {
          browser.storage.local.set({ browserActionBadgesClicked: true });
          browser.browserAction.setBadgeBackgroundColor({ color: null });
          browser.browserAction.setBadgeText({ text: "" });
        }
    }
  },
};

document.onreadystatechange = () => {
  if (document.readyState === "interactive") {
    popup.init();
  }
};