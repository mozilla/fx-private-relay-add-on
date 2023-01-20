(async () => {
  // Global Data
  const { relaySiteOrigin } = await browser.storage.local.get(
    "relaySiteOrigin"
  );

  const state = {
    currentPanel: null
  }

  const popup = {
    events: {
      backClick: (e) => {
        e.preventDefault();
        const backTarget = e.target.dataset.backTarget;
        document.querySelector(".js-internal-link.is-active")?.classList.remove("is-active");
        popup.panel.update(backTarget);
      },
      navigationClick: (e) => {
        e.preventDefault();
        document.querySelector(".js-internal-link.is-active")?.classList.remove("is-active");
        e.target.classList.add("is-active");
        const panelId = e.target.dataset.panelId;
        popup.panel.update(panelId);
      },
    },
    init: async () => {
      // Set Navigation Listeners
      const navigationButtons = document.querySelectorAll(".js-internal-link");
      navigationButtons.forEach((button) => {
        button.addEventListener("click", popup.events.navigationClick, false);
      });

      // Set Back Button Listeners
      const backButtons = document.querySelectorAll(".fx-relay-panel-header-btn-back");
      backButtons.forEach((button)=> {
        button.addEventListener("click", popup.events.backClick, false);
      });
      
      // Check if user is signed in to show default/sign-in panel
      if (await popup.utilities.isUserSignedIn()) {
        popup.panel.update("masks");
        popup.utilities.unhideNavigationItemsOnceLoggedIn();
      } else {
        popup.panel.update("sign-up");
      }

      // Set External Event Listerners
      await popup.utilities.setExternalEventListeners();
      
    },
    panel: {
      update: (panelId) => {
        const panels = document.querySelectorAll(".fx-relay-panel");
        panels.forEach((panel) => {
          panel.classList.add("is-hidden");

          if (panel.dataset.panelId === panelId) {
            panel.classList.remove("is-hidden");
            popup.panel.init(panelId);
          }
        });

        state.currentPanel = panelId;
      },
      init: (panelId) => {
        const panel = document.getElementById(`${panelId}-panel`);        
        console.log(panel);
        // console.log(state.currentPanel);
      },
    },
    utilities: {
      isUserSignedIn: async () => {
        const userApiToken = await browser.storage.local.get("apiToken");
        const signedInUser = Object.prototype.hasOwnProperty.call(
          userApiToken,
          "apiToken"
        );
        return signedInUser;
      },
      clearBrowserActionBadge: async () => {
        const { browserActionBadgesClicked } = await browser.storage.local.get(
          "browserActionBadgesClicked"
        );

        // Dismiss the browserActionBadge only when it exists
        if (browserActionBadgesClicked === false) {
          browser.storage.local.set({ browserActionBadgesClicked: true });
          browser.browserAction.setBadgeBackgroundColor({ color: null });
          browser.browserAction.setBadgeText({ text: "" });
        }
      },
      setExternalEventListeners: async () => {
        const externalLinks = document.querySelectorAll(".js-external-link");
                
        externalLinks.forEach(link => {
          link.href = `${relaySiteOrigin}/${link.dataset.href}`;

          link.addEventListener("click", async (e) => {
            e.preventDefault();
            if (e.target.dataset.eventLabel && e.target.dataset.eventAction) {
              sendRelayEvent("Panel", e.target.dataset.eventAction, e.target.dataset.eventLabel);
            }
            await browser.tabs.create({ url: link.href });
            window.close();
          });
        });
      },
      unhideNavigationItemsOnceLoggedIn: ()=> {
        document.querySelectorAll(".fx-relay-menu-dashboard-link.is-hidden").forEach(link => {
          link.classList.remove("is-hidden");
        })
      }
    },
  };

  popup.init();
  
})();
