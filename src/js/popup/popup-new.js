/* global getBrowser */

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

        // Custom rule to send "Closed Report Issue" event
        if (e.target.dataset.navId && e.target.dataset.navId === "webcompat") {
          sendRelayEvent("Panel", "click", "closed-report-issue");
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
          case "stats":
            sendRelayEvent("Panel", "click", "opened-stats");
            popup.panel.stats.init();
            break;

          case "webcompat":
            sendRelayEvent("Panel", "click", "opened-report-issue");
            popup.panel.webcompat.init();
            break;

          default:
            break;
        }
      },
      stats: {
        init: async ()=> {
            //Get profile data from site
            const { aliasesUsedVal } = await browser.storage.local.get("aliasesUsedVal");
            const { emailsForwardedVal } = await browser.storage.local.get("emailsForwardedVal");
            const { emailsBlockedVal } = await browser.storage.local.get("emailsBlockedVal");
            const { emailTrackersRemovedVal } = await browser.storage.local.get("emailTrackersRemovedVal");

            const statSet = document.querySelector(".dashboard-stats-list");
            
            const aliasesUsedValEl = statSet.querySelector(".aliases-used");
            const emailsBlockedValEl = statSet.querySelector(".emails-blocked");
            const emailsForwardedValEl = statSet.querySelector(".emails-forwarded");
            const emailTrackersRemovedValEl = statSet.querySelector(".email-trackers-removed");

            aliasesUsedValEl.textContent = aliasesUsedVal;
            emailsBlockedValEl.textContent = emailsBlockedVal;
            emailsForwardedValEl.textContent = emailsForwardedVal;
            emailTrackersRemovedValEl.textContent = emailTrackersRemovedVal;
        }
      },
      webcompat: {
        init: () => {
          popup.panel.webcompat.setURLwithIssue();
          popup.panel.webcompat.showReportInputOtherTextField();
          popup.panel.webcompat.showSuccessReportSubmission();

          const reportForm = document.querySelector(".report-issue-content");
          reportForm.addEventListener("submit", async (event) => {
            await popup.panel.webcompat.handleReportIssueFormSubmission(event);
          });

          const reportContinueButton = document.querySelector(".report-continue");
          reportContinueButton.addEventListener("click", popup.events.backClick, false);

        },
        setURLwithIssue: async () => {
          // Add Site URL placeholder
          const currentPage = (await popup.utilities.getCurrentPage()).url;
          const reportIssueSubmitBtn = document.querySelector(
            ".report-issue-submit-btn"
          );
          const inputFieldUrl = document.querySelector(
            'input[name="issue_on_domain"]'
          );
          reportIssueSubmitBtn.disabled = true;

          // Allow for custom URL inputs
          inputFieldUrl.addEventListener("input", () => {
            reportIssueSubmitBtn.disabled = true;
            // Ensure that the custom input looks like a URL without https:// or http:// (e.g. test.com, www.test.com)
            if (popup.utilities.isSortaAURL(inputFieldUrl.value)) {
              reportIssueSubmitBtn.disabled = false;
            }
          });

          // Check that the host site has a valid URL
          if (currentPage) {
            const url = new URL(currentPage);
            // returns a http:// or https:// value
            inputFieldUrl.value = url.origin;
            reportIssueSubmitBtn.disabled = false;
          }
        },
        showReportInputOtherTextField: () => {
          const otherCheckbox = document.querySelector('input[name="issue-case-other"]');
          const otherTextField = document.querySelector('input[name="other_issue"]');
          otherCheckbox.addEventListener("click", () => {
            otherTextField.classList.toggle("is-hidden");
          })

          // Add placeholder to report input on 'Other' selection
          const inputFieldOtherDetails = document.querySelector('input[name="other_issue"]');
          inputFieldOtherDetails.placeholder = browser.i18n.getMessage("popupReportIssueCaseOtherDetails");
        },
        showSuccessReportSubmission: () => {
          const reportIssueSubmitBtn = document.querySelector(".report-issue-submit-btn");
          const reportSuccess = document.querySelector(".report-success");
          const reportContent = document.querySelector(".report-issue-content");
          reportIssueSubmitBtn.addEventListener("click", () => {
            reportSuccess.classList.remove("is-hidden");
            reportContent.classList.add("is-hidden");
          });
        },
        handleReportIssueFormSubmission: async (event) => {
          event.preventDefault();
          const data = new FormData(event.target);
          const reportData = Object.fromEntries(data.entries());
          reportData.user_agent = await getBrowser();

          Object.keys(reportData).forEach(function(value) {
            // Switch "on" to true
            if (reportData[value] === "on") {
              reportData[value] = true;
            }
            // Remove from report if empty string
            if (reportData[value] === "") {
              delete reportData[value];
            }
          });

          // Clean URL data to add "http://" before it if the custom input doesn't contain a HTTP protocol
          if (!(reportData.issue_on_domain.startsWith("http://") || reportData.issue_on_domain.startsWith("https://"))) {
            reportData.issue_on_domain = "http://" + reportData.issue_on_domain;
          }
          
          await browser.runtime.sendMessage({
            method: "postReportWebcompatIssue",
            description: reportData
          });
        },
      },
    },
    utilities: {
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
      isSortaAURL: (str) => {
        return str.includes(".") && !str.endsWith(".") && !str.startsWith(".");
      },
      isUserSignedIn: async () => {
        const userApiToken = await browser.storage.local.get("apiToken");
        const signedInUser = Object.prototype.hasOwnProperty.call(
          userApiToken,
          "apiToken"
        );
        return signedInUser;
      },
      getCurrentPage: async () => {
        const [currentTab] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        return currentTab;
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
