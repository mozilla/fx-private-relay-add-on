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
        const backNavLevel = e.target.dataset.navLevel;
        
        if (backNavLevel === "root") {
          document.querySelector(".js-internal-link.is-active")?.classList.remove("is-active");
        }

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
      await popup.utilities.setExternalLinkEventListeners();
      
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
        // const panel = document.getElementById(`${panelId}-panel`);        
        switch (panelId) {
          case "settings":
            popup.utilities.enableInputIconDisabling();
            // Function is imported from data-opt-out-toggle.js
            enableDataOptOut(); 

            document.getElementById("popupSettingsReportIssue").addEventListener("click", (e)=>{
              e.preventDefault();
              popup.panel.update("webcompat");
            }, false)
            
            break;

          default:
            break;
        }
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
      enableInputIconDisabling: async () => {
        const inputIconVisibilityToggle = document.querySelector(".toggle-icon-in-page-visibility");

        const stylePrefToggle = (inputsEnabled) => {
          if (inputsEnabled === "show-input-icons") {
            inputIconVisibilityToggle.dataset.iconVisibilityOption = "disable-input-icon";
            inputIconVisibilityToggle.classList.remove("input-icons-disabled");
            return;
          }
          inputIconVisibilityToggle.dataset.iconVisibilityOption = "enable-input-icon";
          inputIconVisibilityToggle.classList.add("input-icons-disabled");
        };

        const iconsAreEnabled = await areInputIconsEnabled();
        const userIconChoice = iconsAreEnabled ? "show-input-icons" : "hide-input-icons";
        stylePrefToggle(userIconChoice);

        inputIconVisibilityToggle.addEventListener("click", async () => {
          const userIconPreference = (inputIconVisibilityToggle.dataset.iconVisibilityOption === "disable-input-icon") ? "hide-input-icons" : "show-input-icons";
          await browser.runtime.sendMessage({
            method: "updateInputIconPref",
            iconPref: userIconPreference,
          });
          sendRelayEvent("Panel", "click", userIconPreference);
          return stylePrefToggle(userIconPreference);
        });        
      },
      setExternalLinkEventListeners: async () => {
        const externalLinks = document.querySelectorAll(".js-external-link");
                
        externalLinks.forEach(link => {
          // Because we dynamically set the Relay origin URL (local/dev/stage/prod), 
          // we have to catch Relay-specific links and prepend the correct Relay website URL
          if (link.dataset.relayInternal === "true") {
            link.href = `${relaySiteOrigin}/${link.dataset.href}`;
          } else {
            link.href = `${link.dataset.href}`;
          }
          

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
