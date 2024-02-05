/* global getBrowser checkWaffleFlag psl */

(async () => {
  // Global Data
  const { relaySiteOrigin } = await browser.storage.local.get(
    "relaySiteOrigin"
  );

  const sessionState = {
    currentPanel: null,
    primaryPanel: "masks",
    newsItemsCount: null,
    loggedIn: false,
    newsContent: []
  };

  const popup = {
    events: {
      backClick: (e) => {
        e.preventDefault();
        const target = e.currentTarget; 

        let backTarget = target.dataset.backTarget;
        const backNavLevel = target.dataset.navLevel;
        let data;
        if (backNavLevel === "root") {
          document.querySelector(".js-internal-link.is-active")?.classList.remove("is-active");
          document.querySelector(`.fx-relay-primary-dashboard-switcher-btn.${sessionState.primaryPanel}`).classList.add("is-active");
          
          backTarget = sessionState.primaryPanel;
          data = { backTarget: true }
        }

        // Custom rule to send "Closed Report Issue" event
        if (target.dataset.navId && target.dataset.navId === "webcompat") {
          sendRelayEvent("Panel", "click", "closed-report-issue");
        }

        // Custom rule to fix Firefox bug where popup does not 
        // resize from larger sized panels to smaller sized panels
        if (target.dataset.navId && target.dataset.navId === "custom") {
          const maskPanel = document.querySelector("masks-panel");
          maskPanel.classList.add("custom-return");
          
          setTimeout(() => {
            maskPanel.classList.remove("custom-return");
          }, 10);
          
        }

        // Catch back button clicks if the user is logged out
        if (!sessionState.loggedIn && backNavLevel === "root") {
          popup.panel.update("sign-up");
          return;
        }

        popup.panel.update(backTarget, data);
      },
      dismissErrorClick: async (e) => {
        e.preventDefault();
        e.target.classList.remove("is-shown");
      },
      externalClick: async (e) => {
        e.preventDefault();
        if (e.target.dataset.eventLabel && e.target.dataset.eventAction) {
          sendRelayEvent(
            "Panel",
            e.target.dataset.eventAction,
            e.target.dataset.eventLabel
          );
        }
        await browser.tabs.create({ url: e.target.href });
        window.close();
      },
      navigationClick: (e) => {
        e.preventDefault();
        document
          .querySelector(".js-internal-link.is-active")
          ?.classList.remove("is-active");
        e.currentTarget.classList.add("is-active");
        const panelId = e.currentTarget.dataset.panelId;
        popup.panel.update(panelId);
        e.currentTarget.blur();
      },
      generateMask: async (event, type = "random", data = null) => {
        
        // Types: "random", "custom"
        sendRelayEvent("Panel", "click", `popup-generate-${type}-mask`);
        preventDefaultBehavior(event);

        const isRandomMask = (type == "random");
        const isCustomMask = (type == "custom");
        const { premium } = await browser.storage.local.get("premium");

        event.target.classList.add("is-loading");

        const newRelayAddressResponseArgs = isCustomMask ?  { method: "makeDomainAddress" } : { method: "makeRelayAddress" }
        
        if (isRandomMask) {
          // When rebuilding panel, scroll to the top of it
          const panel = document.querySelector(".fx-relay-mask-list");
          panel.scrollIntoView(true);
        } 

        // Request the active tab from the background script and parse the `document.location.hostname`
        const currentPageHostName = await browser.runtime.sendMessage({
          method: "getCurrentPageHostname",
        });

        // If active tab is a non-internal browser page, add a label to the creation request
        if (currentPageHostName !== null) {
          newRelayAddressResponseArgs.description = currentPageHostName;
        }

        if (isCustomMask && data) {
          newRelayAddressResponseArgs.address = data.address
          newRelayAddressResponseArgs.block_list_emails = data.block_list_emails
        }

        // Attempt to create a new alias
        const newRelayAddressResponse = await browser.runtime.sendMessage(newRelayAddressResponseArgs);

        // Catch edge cases where the "Generate New Alias" button is still enabled,
        // but the user has already reached the max number of aliases.
        if (newRelayAddressResponse.status === 402) {
          event.target.classList.remove("is-loading");
          throw new Error(
            browser.i18n.getMessage("pageInputIconMaxAliasesError_mask")
          );
        }

        // Reset previous form
        if (premium && isCustomMask) {
            const customMaskDomainInput = document.getElementById("customMaskName");
            customMaskDomainInput.value = "";
            const customMaskBlockPromosCheckbox = document.getElementById("customMaskBlockPromos");
            customMaskBlockPromosCheckbox.checked = false;
        }
        
        // Catch edge cases where the "Generate New Alias" button is still enabled,
        // but the user has already reached the max number of aliases.
        if (newRelayAddressResponse.status === 409 || newRelayAddressResponse.status === 400) {
          event.target.classList.remove("is-loading");
          
          const errorMessage = document.querySelector(".fx-relay-masks-error-message");
          errorMessage.classList.add("is-shown");
          
          errorMessage.addEventListener("click",popup.events.dismissErrorClick, false);

          await popup.panel.masks.utilities.buildMasksList({newMaskCreated: false});
          
          return;
        }

        event.target.classList.remove("is-loading");

        // Hide onboarding panel
        const noMasksCreatedPanel = document.querySelector(".fx-relay-no-masks-created");
        noMasksCreatedPanel.classList.add("is-hidden");

        await popup.panel.masks.utilities.buildMasksList({newMaskCreated: true});

        
        if (!premium) {
          await popup.panel.masks.utilities.setRemainingMaskCount();
        }

      }
    },
    init: async () => {

      const { isAndroid } = await browser.storage.local.get(
        "isAndroid"
      );

      // Add CSS class for custom Firefox for Android styles to the panel
      if (isAndroid) {
        document.body.classList.add("is-android")
      }
      
      // Set Navigation Listeners
      const navigationButtons = document.querySelectorAll(".js-internal-link");
     
      navigationButtons.forEach((button) => {
        button.addEventListener("click", popup.events.navigationClick, false);
      });

      sessionState.loggedIn = await popup.utilities.isUserSignedIn();

      // Check if user is signed in to show default/sign-in panel
      if (sessionState.loggedIn) { 
        popup.panel.update("masks");
        popup.utilities.unhideNavigationItemsOnceLoggedIn();
        // populateNewsFeed Also sets Notification Bug for Unread News Items
        popup.utilities.populateNewsFeed();
        document.body.classList.remove("is-loading");
      } else {
        popup.panel.update("sign-up");
        document.body.classList.remove("is-loading");
      }

      // Set External Event Listerners
      await popup.utilities.setExternalLinkEventListeners();

      // Clear browser action "!" badge
      await popup.utilities.clearBrowserActionBadge();

      // Note: There's a chain of functions that run from init, and end with putting focus on the most reasonable element: 
      // Cases:
      //   If not logged in: focused on "Sign In" button
      //   (Both tiers) If no masks made: focused on primary generate mask button
      //   If free tier: focused on "Create mask" button
      //   If premium tier: focused in search bar
    },
    panel: {
      initializePanelContext: () => {
        // Remove any existing back buttons, there should only be one once the panel is built
        let backBtn = document.querySelector('.fx-relay-panel-header-btn-back');
        backBtn?.parentNode.removeChild(backBtn);
        let footer = document.querySelector(".fx-relay-footer-nav");
        footer?.classList.remove('left-align'); // Left alignment is only re-added when buildBackButton runs

        // Hide primary masks/phones dashboard tabs and "stats" button in footer
        document.querySelector(".fx-relay-primary-dashboard-switcher")?.classList.add("is-hidden");
        document.querySelector(".fx-relay-menu-dashboard-link.footer.stats")?.classList.add("is-hidden");

      },
      setPanelContextTabs: (panelId, data) => {
        // This function is for panels that have independent primary "emails" and "phones" tabs
        // The initial email and phones tab context is already set as the default.
        // For all other panels that need independent tabs, set them here. 

        // Set independent stats tab
        const activeTab = panelId === "stats" ? sessionState.primaryPanel : panelId;
        const initializeStats = sessionState.currentPanel === "stats" && (panelId === "phone-masks" || panelId === "masks") && !data?.backTarget;

        if (panelId === "stats" || initializeStats) {
          document.querySelector(".fx-relay-primary-dashboard-switcher")?.classList.remove("is-hidden")
          document.querySelector(".js-internal-link.is-active")?.classList.remove("is-active");
          document.querySelector(`.fx-relay-primary-dashboard-switcher-btn.${activeTab}`).classList.add("is-active");
          
          const primaryBtn = document.querySelector(`.fx-relay-primary-dashboard-switcher-btn.${activeTab}`) 
          popup.ariaControls.setSelected(primaryBtn);
          popup.ariaControls.setControls(primaryBtn, activeTab);

          if (initializeStats) {
            sessionState.primaryPanel = panelId; // Update primary panel if it changed
            popup.panel.init("stats", data);
            return true;
          } 
        } 

        return false;
      },
      update: (panelId, data) => {
        popup.panel.initializePanelContext();
        if (popup.panel.setPanelContextTabs(panelId, data)) {
          return;
        }
       
        const panels = document.querySelectorAll(".fx-relay-panel");

        panels.forEach((panel) => {
          panel.classList.add("is-hidden");

          if (panel.dataset.panelId === panelId) {
            panel.classList.remove("is-hidden");
            popup.panel.init(panelId, data);
          }
        });

        sessionState.currentPanel = panelId;
      },
      init: (panelId, data) => {
        const phonesBtn = document.querySelector(".fx-relay-primary-dashboard-switcher-btn.phone-masks");
        const masksBtn = document.querySelector(".fx-relay-primary-dashboard-switcher-btn.masks");

        switch (panelId) {
          case "custom": 
            popup.panel.masks.custom.init();
            popup.utilities.buildBackButton("custom", "root", "masks");
            break;

          case "masks":
            popup.panel.masks.init();
            popup.utilities.setPrimaryPanel(panelId);
            popup.ariaControls.setSelected(masksBtn);
            popup.ariaControls.setControls(masksBtn, panelId);
            break;

          case "phone-masks":
            popup.panel.phoneMasks.init();
            popup.utilities.setPrimaryPanel(panelId);
            popup.ariaControls.setSelected(phonesBtn);
            popup.ariaControls.setControls(phonesBtn, panelId);
            break;

          case "news":
            sendRelayEvent("Panel", "click", "opened-news");
            popup.panel.news.init();
            popup.panel.news.utilities.updateNewsItemCountNotification(true);
            popup.utilities.buildBackButton("", "root", "masks");
            break;

          case "survey":
            sendRelayEvent("Panel", "click", "opened-CSAT");
            popup.panel.survey.init();
            popup.utilities.buildBackButton("", "root", "masks");
            break;

          case "newsItem":
            sendRelayEvent("Panel", "click", "opened-news-item");
            popup.panel.news.item.update(data.newsItemId);
            popup.utilities.buildBackButton("newsItem", "child", "news");
            break;

          case "settings":
            sendRelayEvent("Panel", "click", "opened-settings");
            popup.panel.settings.init();
            popup.utilities.buildBackButton("", "root", "masks");
            break;

          case "stats":
            sendRelayEvent("Panel", "click", "opened-stats");
            popup.panel.stats.init();
            popup.utilities.buildBackButton("", "root", "masks");

            break;

          case "webcompat":
            sendRelayEvent("Panel", "click", "opened-report-issue");
            popup.panel.webcompat.init();
            popup.utilities.buildBackButton("webcompat", "child", "settings");
            break;
        }
      },
      masks: {
        custom: {
          init: async () => {
            const customMaskForm = document.querySelector(".fx-relay-panel-custom-mask-form");
            const customMaskDomainInput = customMaskForm.querySelector(".fx-relay-panel-custom-mask-input-name");
            const customMaskDomainLabel = customMaskForm.querySelector(".fx-relay-panel-custom-mask-input-domain");
            const customMaskDomainSubmitButton = customMaskForm.querySelector(".fx-relay-panel-custom-mask-submit button");
            customMaskDomainInput.placeholder = browser.i18n.getMessage("popupCreateCustomFormMaskInputPlaceholder");
            customMaskDomainLabel.textContent = browser.i18n.getMessage("popupCreateCustomFormMaskInputDescription", sessionState.premiumSubdomain);

            customMaskDomainInput.addEventListener("input", popup.panel.masks.custom.validateForm);
            customMaskForm.addEventListener("submit", popup.panel.masks.custom.submit);

            const currentPageHostName = await browser.runtime.sendMessage({
              method: "getCurrentPageHostname",
            });

            if (currentPageHostName) {
              const parsedDomain = psl.parse(currentPageHostName)
              customMaskDomainInput.value = parsedDomain.sld;
              customMaskDomainSubmitButton.disabled = false
            }

            customMaskDomainInput.focus();
            
          },
          submit: async (event) => {
            event.preventDefault();
            const customMaskDomainInput = document.getElementById("customMaskName");
            const customMaskBlockPromosCheckbox = document.getElementById("customMaskBlockPromos");

            if (!customMaskDomainInput.value) {
              throw new Error(`No address name set`)
            }

            popup.events.generateMask(event, "custom", {
              address: customMaskDomainInput.value,
              block_list_emails: customMaskBlockPromosCheckbox.checked,
            });

            popup.panel.update("masks");
            
          },
          validateForm: async () => {
            const customMaskForm = document.querySelector(".fx-relay-panel-custom-mask-form");
            const customMaskDomainInput = customMaskForm.querySelector(".fx-relay-panel-custom-mask-input-name");
            const customMaskDomainSubmitButton = customMaskForm.querySelector(".fx-relay-panel-custom-mask-submit button");

            // If there's input, make the form submission possible
            customMaskDomainSubmitButton.disabled = !(customMaskDomainInput.value)
          }
        },
        init: async () => { 
          const generateRandomMask = document.querySelector(".js-generate-random-mask");
          const { premium } = await browser.storage.local.get("premium");
          const { dataCollection } = await browser.storage.local.get(
            "dataCollection"
          );
          const maskPanel = document.getElementById("masks-panel");
          let getMasksOptions = { fetchCustomMasks: false };

          // logic to show survey is found in shouldShowSurvey function
          const shouldShowCSAT = await popup.panel.survey.utils.shouldShowSurvey();
          const csatSurveyFlag = await checkWaffleFlag('csat_survey');
          
          if (shouldShowCSAT && csatSurveyFlag && dataCollection === "data-enabled") {
            const survey = popup.panel.survey;

            survey.utils.showSurveyLink();

            // Show the survey panel when the link is clicked
            survey.select
              .surveyLink()
              .addEventListener("click", async () =>
                popup.panel.update("survey")
              );

            survey.select
              .viewSurveyLinkButton()
              .addEventListener("click", async () => {
                popup.panel.update("survey")
            });

            // Dismiss the survey panel when the user clicks on Dismiss - intentional dismissal
            survey.select
              .surveyDismiss()
              .addEventListener("click", async () => {
                const { profileID } = await browser.storage.local.get("profileID"); 
                const reasonToShow = await popup.panel.survey.utils.getReasonToShowSurvey();

                await popup.utilities.dismissByReason(reasonToShow, profileID);

                sendRelayEvent("CSAT Survey", "click", "dismissed-CSAT");
                window.close();
              });
          }

          if (!premium) {
            await popup.panel.masks.utilities.setRemainingMaskCount();
            maskPanel.setAttribute("data-account-level", "free");
          } else {            
            maskPanel.setAttribute("data-account-level", "premium");

            // Update language of Generate Random Mask to "Generate random mask"
            generateRandomMask.textContent = browser.i18n.getMessage("pageInputIconGenerateRandomMask");

            // Prompt user to register subdomain
            const { premiumSubdomainSet } = await browser.storage.local.get("premiumSubdomainSet");
            const isPremiumSubdomainSet = (premiumSubdomainSet !== "None");  
            
            // Store this query locally for this session
            sessionState.premiumSubdomainSet = isPremiumSubdomainSet;

            // Make sure to query both custom and random masks
            getMasksOptions.fetchCustomMasks = isPremiumSubdomainSet;
          
            // premiumSubdomain is not set : display CTA to prompt user to register subdomain
            if (!sessionState.premiumSubdomainSet) {
              const registerSubdomainButton = document.querySelector(".fx-relay-regsiter-subdomain-button");
              registerSubdomainButton.classList.remove("is-hidden");
            } else {

              sessionState.premiumSubdomain = premiumSubdomainSet;
              const generateCustomMask = document.querySelector(".js-generate-custom-mask");
              
              // Show "Generate custom mask" button
              generateCustomMask.classList.remove("is-hidden");

              generateCustomMask.addEventListener("click", (e) => {
                e.preventDefault();
                popup.panel.update("custom");
              }, false);
              
              // Restyle Random Mask button to secondary
              generateRandomMask.classList.remove("t-primary");
              generateRandomMask.classList.add("t-secondary");
            }
          }
          
          generateRandomMask.addEventListener("click", (e) => {
              popup.events.generateMask(e, "random");
            }, false);
          
          // Build initial list
          // Note: If premium, buildMasksList runs `popup.panel.masks.search.init()` after completing
          // If no masks are created, this will show onboarding prompt
          popup.panel.masks.utilities.buildMasksList();
        },
        search: {
          filter: (query)=> {
            
            const searchInput = document.querySelector(".fx-relay-masks-search-input");
            searchInput.classList.add("is-active");

            const maskSearchResults = Array.from(document.querySelectorAll(".fx-relay-mask-list li"));

            maskSearchResults.forEach((maskResult) => {
              const emailAddress = maskResult.dataset.maskAddress;
              const label = maskResult.dataset.maskDescription;
              const usedOn = maskResult.dataset.maskUsedOn;
              const generated = maskResult.dataset.maskGenerated;
              
              // Check search input against any mask name, label or used-on/generated for web details
              const matchesSearchFilter =
                emailAddress.toLowerCase().includes(query.toLowerCase()) ||
                label.toLowerCase().includes(query.toLowerCase()) ||
                usedOn.toLowerCase().includes(query.toLowerCase()) ||
                generated.toLowerCase().includes(query.toLowerCase());
              
              if (matchesSearchFilter) {
                maskResult.classList.remove("is-hidden");
              } else {
                maskResult.classList.add("is-hidden");
              }

              // Set #/# labels inside search bar to show results count
              const searchFilterTotal = document.querySelector(".js-filter-masks-total");
              const searchFilterVisible = document.querySelector(".js-filter-masks-visible");

              searchFilterVisible.textContent = maskSearchResults.filter((maskResult) => !maskResult.classList.contains("is-hidden")).length;
              searchFilterTotal.textContent = maskSearchResults.length;
            });
            
          },
          init: () => {            
            const searchForm = document.querySelector(".fx-relay-masks-search-form");
            
            const searchInput = document.querySelector(".fx-relay-masks-search-input");
            searchInput.placeholder = browser.i18n.getMessage("labelSearch");

            searchForm.addEventListener("submit", (event) => {
              event.preventDefault();
              searchInput.blur();
            });

            searchInput.addEventListener("input", (event) => {
              if (event.target.value.length) {
                popup.panel.masks.search.filter(event.target.value);
                return;
              }

              popup.panel.masks.search.reset()
            });
            
            searchInput.addEventListener("reset", popup.panel.masks.search.reset);

            const maskSearchResults = Array.from(document.querySelectorAll(".fx-relay-mask-list li"));
            const searchFilterTotal = document.querySelector(".js-filter-masks-total");
            const searchFilterVisible = document.querySelector(".js-filter-masks-visible");
            searchFilterVisible.textContent = maskSearchResults.length;
            searchFilterTotal.textContent = maskSearchResults.length;
            
            // Show bar if there's at least one mask created
            if (maskSearchResults.length) {
              searchForm.classList.add("is-visible");
              searchInput.focus();
            }
          },
          reset: () => {
            const searchInput = document.querySelector(".fx-relay-masks-search-input");
            searchInput.classList.remove("is-active");

            const maskSearchResults = Array.from(document.querySelectorAll(".fx-relay-mask-list li"));
            const searchFilterTotal = document.querySelector(".js-filter-masks-total");
            const searchFilterVisible = document.querySelector(".js-filter-masks-visible");
            searchFilterVisible.textContent = maskSearchResults.length;
            searchFilterTotal.textContent = maskSearchResults.length;

            maskSearchResults.forEach((maskResult) => {
              maskResult.classList.remove("is-hidden");
            });

          }
        },
        utilities: {
          buildMasksList: async (opts = null) => {
            let getMasksOptions = { fetchCustomMasks: false };
            const { premium } = await browser.storage.local.get("premium");

            if (premium) {
              // Check if user may have custom domain masks
              const { premiumSubdomainSet } = await browser.storage.local.get(
                "premiumSubdomainSet"
              );

              // API Note: If a user has not registered a subdomain yet, its default stored/queried value is "None";
              const isPremiumSubdomainSet = premiumSubdomainSet !== "None";
              getMasksOptions.fetchCustomMasks = isPremiumSubdomainSet;

              // If not set, prompt user to register domain
              if (!isPremiumSubdomainSet) {
                const registerSubdomainButton = document.querySelector(".fx-relay-regsiter-subdomain-button");
                registerSubdomainButton.classList.remove("is-hidden");
              }

              // Show Generate Button
              const generateRandomMask = document.querySelector(".js-generate-random-mask");
              generateRandomMask.classList.remove("is-hidden");              
            }
            
            const masks = await popup.utilities.getMasks(getMasksOptions);
            
            const maskList = document.querySelector(".fx-relay-mask-list");

            // Reset mask list
            maskList.textContent = "";
            
            // Generate and append each mask item to the mask list
            masks.forEach( mask => {
                const maskListItem = popup.panel.masks.utilities.buildMaskListItem(mask);
                maskList.append(maskListItem);
            });

            // Display "Mask created" temporary label when a new mask is created in the panel
            if (opts && opts.newMaskCreated && maskList.firstElementChild) {
              maskList.firstElementChild.classList.add("is-new-mask");

              setTimeout(() => {
                maskList.firstElementChild.classList.remove("is-new-mask");
              }, 1000);
            }

            // If user has no masks created, show onboarding prompt and focus on random gen button
            if (masks.length === 0) {
              const noMasksCreatedPanel = document.querySelector(".fx-relay-no-masks-created");
              noMasksCreatedPanel.classList.remove("is-hidden");
              
              const generateRandomMask = document.querySelector(".js-generate-random-mask");
              generateRandomMask.focus();

              // Remove loading state since exiting early
              document.body.classList.remove("is-loading");
              return;
            }

            // If premium, focus on search instead
            if (premium) {
              popup.panel.masks.search.init();
            }

            // Remove loading state
            document.body.classList.remove("is-loading");

          },
          buildMaskListItem: (mask) => {
            const maskListItem = document.createElement("li");

            // Attributes used to power search filtering
            maskListItem.setAttribute("data-mask-address", mask.full_address);              
            maskListItem.setAttribute("data-mask-description", mask.description ?? "");
            maskListItem.setAttribute("data-mask-used-on", mask.used_on ?? "");
            maskListItem.setAttribute("data-mask-generated", mask.generated_for ?? "");
            
            maskListItem.classList.add("fx-relay-mask-item");

            const maskListItemNewMaskCreatedLabel = document.createElement("span");
            maskListItemNewMaskCreatedLabel.textContent = browser.i18n.getMessage("labelMaskCreated");
            maskListItemNewMaskCreatedLabel.classList.add("fx-relay-mask-item-new-mask-created");
            maskListItem.append(maskListItemNewMaskCreatedLabel);
            
            const maskListItemAddressBar = document.createElement("div");
            maskListItemAddressBar.classList.add("fx-relay-mask-item-address-bar");

            const maskListItemAddressWrapper = document.createElement("div");
            maskListItemAddressWrapper.classList.add("fx-relay-mask-item-address-wrapper");

            const maskListItemLabel = document.createElement("span");
            maskListItemLabel.classList.add("fx-relay-mask-item-label");
            maskListItemLabel.textContent = mask.description;
            
            // Append Label if it exists
            if (mask.description !== "") {
              maskListItemAddressWrapper.append(maskListItemLabel);
            }
            
            const maskListItemAddress = document.createElement("div");
            maskListItemAddress.classList.add("fx-relay-mask-item-address");
            maskListItemAddress.textContent = mask.full_address;
            maskListItemAddressWrapper.append(maskListItemAddress);

            // Add Mask Address Bar Contents 
            maskListItemAddressBar.append(maskListItemAddressWrapper);

            const maskListItemAddressActions = document.createElement("div");
            maskListItemAddressActions.classList.add("fx-relay-mask-item-address-actions");

            const maskListItemCopyButton = document.createElement("button");
            maskListItemCopyButton.classList.add("fx-relay-mask-item-address-copy");
            maskListItemCopyButton.setAttribute("data-mask-address", mask.full_address);

            const maskListItemCopyButtonSuccessMessage = document.createElement("span");
            maskListItemCopyButtonSuccessMessage.textContent = browser.i18n.getMessage("popupCopyMaskButtonCopied");
            maskListItemCopyButtonSuccessMessage.classList.add("fx-relay-mask-item-address-copy-success");
            maskListItemAddressActions.append(maskListItemCopyButtonSuccessMessage);
            
            maskListItemCopyButton.addEventListener("click", (e)=> {
              e.preventDefault();
              navigator.clipboard.writeText(e.target.dataset.maskAddress);
              maskListItemCopyButtonSuccessMessage.classList.add("is-shown");
              setTimeout(() => {
                maskListItemCopyButtonSuccessMessage.classList.remove("is-shown")
              }, 1000);
            }, false);
            maskListItemAddressActions.append(maskListItemCopyButton);

            const maskListItemToggleButton = document.createElement("button");
            maskListItemToggleButton.classList.add("fx-relay-mask-item-address-toggle");
            maskListItemToggleButton.addEventListener("click", ()=> {
              // TODO: Add Toggle Function
            }, false);
            maskListItemToggleButton.setAttribute("data-mask-id", mask.id);
            maskListItemToggleButton.setAttribute("data-mask-type", mask.mask_type);
            maskListItemToggleButton.setAttribute("data-mask-address", mask.full_address);

            // TODO: Add toggle button back
            // maskListItemAddressActions.append(maskListItemToggleButton);

            maskListItemAddressBar.append(maskListItemAddressActions);
            maskListItem.append(maskListItemAddressBar);
            return maskListItem;
          },
          getRemainingAliases: async () => {
            const masks = await popup.utilities.getMasks();
            const { maxNumAliases } = await browser.storage.local.get("maxNumAliases");
            return { masks, maxNumAliases };
          },
          getRemainingMaskCount: async () => {
            const { masks, maxNumAliases } = await popup.panel.masks.utilities.getRemainingAliases();
            const numRemaining = maxNumAliases - masks.length;
            return numRemaining;
          },
          setRemainingMaskCount: async () => {
            const { masks, maxNumAliases } = await popup.panel.masks.utilities.getRemainingAliases();
            const numRemaining = maxNumAliases - masks.length;
            const masksAvailable = document.querySelector(".fx-relay-masks-available-count");
            const masksLimitReached = document.querySelector(".fx-relay-masks-limit-upgrade-string");
            const limitReachedToast = document.querySelector(".fx-relay-masks-limit-upgrade");

            masksAvailable.textContent = browser.i18n.getMessage("popupFreeMasksAvailable", [numRemaining, maxNumAliases]);
            masksLimitReached.textContent = browser.i18n.getMessage("popupFreeMasksLimitReached", [maxNumAliases]);

            const generateRandomMask = document.querySelector(".js-generate-random-mask");
            
            if (masks.length === 0) {
              generateRandomMask.classList.remove("is-hidden");
              return;
            }
            
            if (numRemaining <= 0) {
              // No masks remaining
              limitReachedToast.classList.remove("is-hidden");
              masksAvailable.classList.add("is-hidden");
              
              // Hide Generate Button
              generateRandomMask.classList.add("is-hidden");

              // Show Upgrade Button
              const getUnlimitedMasksBtn = document.querySelector(".fx-relay-mask-upgrade-button");
              getUnlimitedMasksBtn.classList.remove("is-hidden");
              getUnlimitedMasksBtn.focus();

            } else {
              // Show Masks Count/Generate Button
              masksAvailable.classList.remove("is-hidden");
              generateRandomMask.classList.remove("is-hidden");
              generateRandomMask.focus();
            }
          }
        },
      },
      phoneMasks: {
        init: async () => {  
          const getRelayNumber = await browser.storage.local.get("relayNumbers");
          const getRealPhoneNumber = await browser.storage.local.get("realPhoneNumbers");
          const relayNumberData = popup.utilities.isNumberDataValid(getRelayNumber.relayNumbers);
          const realPhoneNumberData = popup.utilities.isNumberDataValid(getRealPhoneNumber.realPhoneNumbers);
          const defaultView = document.querySelector(".fx-relay-phone-default-view");
          const dynamicView = document.querySelector(".fx-relay-phone-dynamic-view");

          // If there is number data, show the default view
          if (relayNumberData && realPhoneNumberData && realPhoneNumberData.verified) { 
            defaultView.classList.remove("is-hidden");

            // Show relay number 
            const relayNumberContainer = document.getElementById("fx-relay-user-phone-number");
            relayNumberContainer.innerText = relayNumberData.formattedNumber; 

            const realPhoneNumberContainer = document.getElementById("fx-relay-meta-forwarding-to");
            realPhoneNumberContainer.innerText = realPhoneNumberData.formattedNumber;

            const dateRegisteredContainer = document.getElementById("fx-relay-meta-registered-date");
            dateRegisteredContainer.innerText = popup.panel.phoneMasks.utils.formatRegisteredDate(realPhoneNumberData.verified_date);

            popup.panel.phoneMasks.utils.setRelayNumberCountryDetails(relayNumberData);
             
            popup.panel.phoneMasks.utils.updateRelayNumberStateDescription(relayNumberData);
          } else { 
            dynamicView.classList.remove("is-hidden");
            // Show appropriate plan upgrade view
            popup.panel.phoneMasks.utils.setPhonesStatusView();
            return;
          } 

          popup.panel.phoneMasks.utils.loadSegmentedControlIcons();
 
          // Pull fresh relay number data and set forwarding state
          await popup.panel.phoneMasks.utils.getRelayNumberData();
          popup.panel.phoneMasks.utils.setForwardingState();
 
          const segmentedControlGroup = document.querySelector('.fx-relay-segmented-control');
          const radios = segmentedControlGroup.querySelectorAll('input');
          let i = 1;

          // set CSS Var to number of radios we have
          segmentedControlGroup.style.setProperty('--options',radios.length);

          // loop through radio elements
          radios.forEach((input)=>{
             // store position as data attribute
            input.setAttribute('data-pos',i);
             
            // add click handler to change position
            input.addEventListener('click', async (e)=>{ 
              await popup.panel.phoneMasks.utils.updateForwardingState(relayNumberData.id, e.target.getAttribute('data-forwarding') === "true");
              await popup.panel.phoneMasks.utils.getRelayNumberData();
              popup.panel.phoneMasks.utils.setForwardingState();
              await popup.panel.phoneMasks.utils.updateRelayNumberStateDescription();
              segmentedControlGroup.style.setProperty('--options-active',e.target.getAttribute('data-pos'));
            });
 
            i++;
          });

          // add class to enable the sliding pill animation, otherwise it uses a fallback
          segmentedControlGroup.classList.add('useSlidingAnimation');

          const copyRelayNumberButton = document.getElementById("fx-relay-phone-mask-copy-button");
          const copyRelayNumberSuccessMessage = document.getElementById("fx-relay-number-copy-success");

          copyRelayNumberButton.addEventListener("click", (e)=> {
            e.preventDefault(); 

            // Copy relay number to clipboard, remove first 2 characters (country code). 
            navigator.clipboard.writeText(relayNumberData.number.substring(2, relayNumberData.number.length));

            // Show success message
            copyRelayNumberSuccessMessage.classList.add("is-shown");
            setTimeout(() => {
              copyRelayNumberSuccessMessage.classList.remove("is-shown")
            }, 1000);
          }, false); 
 
        },
        utils: {
          updateRelayNumberStateDescription: async () => {
            const getRelayNumber = await browser.storage.local.get("relayNumbers"); 
            const data = popup.utilities.isNumberDataValid(getRelayNumber.relayNumbers);
            const forwardingStateDescription = document.querySelector(".fx-relay-phone-meta-description");  
            forwardingStateDescription.textContent = data.enabled ? browser.i18n.getMessage("popupPhoneMasksMetaForwardingDescription") : browser.i18n.getMessage("popupPhoneMasksMetaBlockingDescription");
          },
          setRelayNumberCountryDetails: (data) => {
            const locationContainer = document.getElementById("fx-relay-user-phone-country");
            const countryImage = locationContainer.querySelector("img");
            const countryDetails = locationContainer.querySelector("span");
            const countryCode = data.number.substring(0, 2);
            const formattedCountryLabel = {
              "US": "U.S.A",
            };
            const countryLabel = formattedCountryLabel[data.country_code] ? formattedCountryLabel[data.country_code] : data.country_code;
            countryImage.src = `/icons/${data.country_code.toLowerCase()}-flag.svg`;
            countryDetails.textContent = `${countryCode} ${countryLabel}`;

          },
          formatRegisteredDate: (dateRegistered) => {
            // format date into something like Oct 15, 2023
            const date = (new Date(dateRegistered)).toDateString().split(' ');
            
            return `${date[1]} ${date[2]}, ${date[3]}`; 
          },
          setForwardingState: async () => {
            // get a fresh copy of the relay numbers
            const getRelayNumber = await browser.storage.local.get("relayNumbers"); 
            const data = popup.utilities.isNumberDataValid(getRelayNumber.relayNumbers);
            const segmentedControlGroup = document.querySelector('.fx-relay-segmented-control');
            const forwardingButton = document.getElementById("fx-relay-phone-forwarding");
            const blockingButton = document.getElementById("fx-relay-phone-blocking");
            
            const setSegmentedControlGroup = (optionsActive, forwardingClass, blockingClass) => {
                segmentedControlGroup.style.setProperty('--options-active', optionsActive);
                forwardingButton.checked = forwardingClass === "fx-relay-selected-segmented-group";
                blockingButton.checked = blockingClass === "fx-relay-selected-segmented-group";
                
                forwardingButton.parentElement.classList = `fx-relay-segmented-control-group ${forwardingClass}`;
                blockingButton.parentElement.classList = `fx-relay-segmented-control-group ${blockingClass}`;
            };
            
            if (data.enabled) { 
                setSegmentedControlGroup(1, "fx-relay-selected-segmented-group", "fx-relay-unselected-segmented-group");
            } else { 
                setSegmentedControlGroup(2, "fx-relay-unselected-segmented-group", "fx-relay-selected-segmented-group");
            }
          },
          updateForwardingState: async (id, enabled) => { 
            await browser.runtime.sendMessage({
              method: "setRelayNumberForwardingState",
              id,
              enabled,
            });  
          },
          getRelayNumberData: async () => {
            await browser.runtime.sendMessage({
              method: "getRelayNumberData", 
            });   
          },
          loadSegmentedControlIcons: () => {
            // adds icons to segmented controls for blocking and forwarding
            const blockingButtonLabelElement = document.getElementById("fx-relay-phone-blocking-button-label");
            const forwardingButtonLabelElement = document.getElementById("fx-relay-phone-forwarding-button-label");
            const hasBlockingIcon = document.getElementById("fx-relay-phone-blocking-button-icon");
            const hasForwardingIcon = document.getElementById("fx-relay-phone-forwarding-button-icon");

            if (blockingButtonLabelElement && !hasBlockingIcon) { 
              const iconElement = document.createElement("img"); 

              iconElement.src = "/icons/block-icon.svg"; 
              iconElement.id = "fx-relay-phone-blocking-button-icon";

              blockingButtonLabelElement.insertBefore(iconElement, blockingButtonLabelElement.firstChild);
            }


            if (forwardingButtonLabelElement && !hasForwardingIcon) { 
              const iconElement = document.createElement("img"); 

              iconElement.src = "/icons/redo-icon.svg"; 
              iconElement.id = "fx-relay-phone-forwarding-button-icon";

              forwardingButtonLabelElement.insertBefore(iconElement, forwardingButtonLabelElement.firstChild);
            } 
          },
          setDynamicView: ({panelTitle, panelDescription, panelCtaText, panelCtaHref, panelCtaEvenLabel}, panelId) => {
            const dynamicView = document.querySelector(`.fx-relay-phone-dynamic-view${panelId ? `.${panelId}` : ""}`);

            const title = dynamicView.querySelector("h1");
            const description = dynamicView.querySelector("p"); 
            const cta = dynamicView.querySelector("button");

            title.textContent = browser.i18n.getMessage(panelTitle);
            description.textContent = browser.i18n.getMessage(panelDescription); 
            cta.textContent = browser.i18n.getMessage(panelCtaText);
            cta.dataset.href = panelCtaHref;
            cta.dataset.eventLabel = panelCtaEvenLabel;
            cta.addEventListener("click", popup.events.externalClick, true);
          }, 
          setPhonesStatusView: async (panelId) => {
            /**
             * panelId (string): Optional variable to select the correct dynamic view.
             */
            const hasPhone = await browser.storage.local.get("has_phone");
            const premium = await browser.storage.local.get("premium");
            const getRealPhoneNumber = await browser.storage.local.get("realPhoneNumbers");
            const getPlans = await browser.storage.local.get("phonePlans");
            const realPhoneNumberData = popup.utilities.isNumberDataValid(getRealPhoneNumber.realPhoneNumbers);

              // If user has premium and has phone, but real phone number is not verified
            if (premium.premium && hasPhone.has_phone && !realPhoneNumberData.verified) {
              popup.panel.phoneMasks.utils.setDynamicView({
                panelTitle: "popupPhoneMasksActivateYourPhoneMaskTitle", 
                panelDescription: "popupPhoneMasksActivateYourPhoneMaskBody",
                panelCtaText: "popupPhoneMasksActivateYourPhoneMaskCta",
                panelCtaHref: ""
              }, panelId);
            }
            
            // If user does not have premium and no phones (free user), show upgrade CTA
            const freeUser = !premium.premium && !hasPhone.has_phone;
            const premiumUserWithNoPhonesPlan = premium.premium && !hasPhone.has_phone;
            if (freeUser || premiumUserWithNoPhonesPlan) {
              popup.panel.phoneMasks.utils.setDynamicView({
                panelTitle: "popupPhoneMasksUpgradeToPhoneMaskTitle", 
                panelDescription: "popupPhoneMasksUpgradeToPhoneMaskBody",
                panelCtaText: "popupPhoneMasksUpgradeToPhoneMaskCta",
                panelCtaHref: ""
              }, panelId);
            }
            
            // If phone plan is not available in country, show waitlist
            if (!getPlans.phonePlans.PHONE_PLANS.available_in_country) {
              popup.panel.phoneMasks.utils.setDynamicView({
                panelTitle: "popUpPhoneMasksNotAvailableTitle", 
                panelDescription: "popUpPhoneMasksNotAvailableBody",
                panelCtaText: "popUpPhoneMasksNotAvailableCta",
                panelCtaHref: ""
              }, panelId);
            }
          },
        }
      },
      news: {
        init: async () => {

          const newsList = document.querySelector(".fx-relay-news");

          // If there's any news items, go build them
          if ( !newsList.hasChildNodes()) {
            sessionState.newsContent.forEach(async (newsItem) => {
              
              // Build and attach news item
              const liFxRelayNewsItem = document.createElement("li");
              liFxRelayNewsItem.classList.add("fx-relay-news-item");

              const button = document.createElement("button");
              button.classList.add("fx-relay-news-item-button");
              button.setAttribute("data-news-item-id", newsItem.id);
              liFxRelayNewsItem.appendChild(button);

              const divTeaserImage = document.createElement("div");
              divTeaserImage.classList.add("fx-relay-news-item-image");

              const imgTeaserImage = document.createElement("img");
              imgTeaserImage.src = newsItem.teaserImg;
              divTeaserImage.appendChild(imgTeaserImage);
              button.appendChild(divTeaserImage);

              const divTeaserCopy = document.createElement("div");
              divTeaserCopy.classList.add("fx-relay-news-item-content");

              const h3TeaserTitle = document.createElement("h3");
              h3TeaserTitle.classList.add("fx-relay-news-item-hero");
              // Pass i18n Args if applicable
              const h3TeaserTitleTextContent = newsItem.headlineStringArgs
                ? browser.i18n.getMessage(
                    newsItem.headlineString,
                    newsItem.headlineStringArgs
                  )
                : browser.i18n.getMessage(newsItem.headlineString);
              h3TeaserTitle.textContent = h3TeaserTitleTextContent;

              const divTeaserBody = document.createElement("div");
              divTeaserBody.classList.add("fx-relay-news-item-body");
              // Pass i18n Args if applicable
              const divTeaserBodyTextContent = newsItem.bodyStringArgs
                ? browser.i18n.getMessage(
                    newsItem.bodyString,
                    newsItem.bodyStringArgs
                  )
                : browser.i18n.getMessage(newsItem.bodyString);
              divTeaserBody.textContent = divTeaserBodyTextContent;

              divTeaserCopy.appendChild(h3TeaserTitle);
              divTeaserCopy.appendChild(divTeaserBody);
              button.appendChild(divTeaserCopy);

              newsList.appendChild(liFxRelayNewsItem);

              button.addEventListener(
                "click",
                popup.panel.news.item.show,
                false
              );
            });
          }
        },
        item: {
          show: (event) => {
            popup.panel.update("newsItem", {
              newsItemId: event.target.dataset.newsItemId,
            });
          },
          update: (newsItemId) => {
            // Get content for news detail view
            if (!sessionState.loggedIn) {
              return;
            }

            const newsItemsContent = sessionState.newsContent.filter((story) => { return story.id == newsItemId });
            const newsItemContent = newsItemsContent[0];
            const newsItemDetail = document.querySelector(".fx-relay-news-story");
            
            // Reset news detail item
            newsItemDetail.textContent = "";

             // Populate HTML
            const newsItemHeroImage = document.createElement("img");
            newsItemHeroImage.src = newsItemContent.fullImg;
            newsItemDetail.appendChild(newsItemHeroImage);
            
            const newsItemHeroTitle = document.createElement("h3");
            const newsItemHeroTitleTextContent = newsItemContent.headlineStringArgs
              ? browser.i18n.getMessage(
                  newsItemContent.headlineString,
                  newsItemContent.headlineStringArgs
                )
              : browser.i18n.getMessage(newsItemContent.headlineString);
            newsItemHeroTitle.textContent = newsItemHeroTitleTextContent;
            newsItemDetail.appendChild(newsItemHeroTitle);
            
            const newsItemHeroBody = document.createElement("div");
            // Pass i18n Args if applicable
            const newsItemHeroBodyTextContent = newsItemContent.bodyStringArgs
              ? browser.i18n.getMessage(
                  newsItemContent.bodyString,
                  newsItemContent.bodyStringArgs
                )
              : browser.i18n.getMessage(newsItemContent.bodyString);
            newsItemHeroBody.textContent = newsItemHeroBodyTextContent;
            newsItemDetail.appendChild(newsItemHeroBody);

            // If the section has a CTA, add it.
            if (newsItemContent.fullCta) {
              const newsItemHeroCTA = document.createElement("a");
              newsItemHeroCTA.classList.add("fx-relay-news-story-link");

              // If the URL points towards Relay, choose the correct server
              if (newsItemContent.fullCtaRelayURL) {
                newsItemHeroCTA.href = `${relaySiteOrigin}${newsItemContent.fullCtaHref}`;
              } else {
                newsItemHeroCTA.href = `${newsItemContent.fullCtaHref}`;
              }
              
              // Set GA data if applicable
              if (newsItemContent.fullCtaEventLabel && newsItemContent.fullCtaEventAction) {
                newsItemHeroCTA.setAttribute("data-event-action", newsItemContent.fullCtaEventAction);
                newsItemHeroCTA.setAttribute("data-event-label", newsItemContent.fullCtaEventLabel);
              }

              newsItemHeroCTA.textContent = browser.i18n.getMessage(newsItemContent.fullCta);
              newsItemHeroCTA.addEventListener("click", popup.events.externalClick, false);
              newsItemDetail.appendChild(newsItemHeroCTA);
            }
          },
        },
        utilities: {
          initNewsItemCountNotification: async () => {
            
            const localStorage = await browser.storage.local.get();

            const unreadNewsItemsCountExists =
              Object.prototype.hasOwnProperty.call(
                localStorage,
                "unreadNewsItemsCount"
              );
              
            const readNewsItemsCountExists =
              Object.prototype.hasOwnProperty.call(
                localStorage,
                "readNewsItemCount"
              );

            // First-run user: No unread data present
            if (!unreadNewsItemsCountExists && !readNewsItemsCountExists) {
              await browser.storage.local.set({
                unreadNewsItemsCount: sessionState.newsItemsCount,
                readNewsItemCount: 0,
              });
            }

            // FIXME: The total news item count may differ than what is displayed to the user
            // Example: Three items total but user doesn't have waffle for one news item. 
            // Regardless - update the unreadNews count to match whatever is in state
            await browser.storage.local.set({
              unreadNewsItemsCount: sessionState.newsItemsCount,
            });

            const { readNewsItemCount } = await browser.storage.local.get(
              "readNewsItemCount"
            );

            const { unreadNewsItemsCount } = await browser.storage.local.get(
              "unreadNewsItemsCount"
            );

            // Set unread count
            const newsItemCountNotification = document.querySelector(
              ".fx-relay-menu-dashboard-link[data-panel-id='news'] .news-count"
            );
            
            const unreadCount = unreadNewsItemsCount - readNewsItemCount;

            // Show count is it exists
            if (unreadCount > 0) {
              newsItemCountNotification.textContent = unreadCount.toString();
              newsItemCountNotification.classList.remove("is-hidden");
            }
            
          },
          updateNewsItemCountNotification: async (markAllUnread = false) => {
            if (markAllUnread) {
              await browser.storage.local.set({
                readNewsItemCount: sessionState.newsItemsCount,
              });

              const newsItemCountNotification = document.querySelector(
                ".fx-relay-menu-dashboard-link[data-panel-id='news'] .news-count"
              );

              newsItemCountNotification.classList.add("is-hidden");

            }
          }
        },
      },
      settings: {
        init: () => {
          popup.utilities.enableInputIconDisabling();

          // Function is imported from data-opt-out-toggle.js
          enableDataOptOut();

          const reportWebcompatIssueLink = document.getElementById("popupSettingsReportIssue");
            
          if (sessionState.loggedIn) {
            reportWebcompatIssueLink.classList.remove("is-hidden");
            reportWebcompatIssueLink.addEventListener("click", (e) => {
                e.preventDefault();
                popup.panel.update("webcompat");
              }, false);
          } else {
            reportWebcompatIssueLink.classList.add("is-hidden");
          }
        }
      },
      stats: {
        init: async () => {
          const emailStatsPanel = document.querySelector(".fx-relay-panel-content.emails-stats");
          const phonesStatsPanel = document.querySelector(".fx-relay-panel-content.phones-stats");
          const phonesStatsList = document.querySelector(".dashboard-stats-list.phones-stats");
          const statsHeader = document.getElementById("stats-panel").firstElementChild;
          const dynamicView = document.querySelector(".fx-relay-phone-dynamic-view.stats");

          const { relayNumbers } = await browser.storage.local.get("relayNumbers");
          const relayNumberData = popup.utilities.isNumberDataValid(relayNumbers);
          const { realPhoneNumbers } = await browser.storage.local.get("realPhoneNumbers");
          const realPhoneNumberData = popup.utilities.isNumberDataValid(realPhoneNumbers);

          // Check if user is premium (and then check if they have a domain set)
          // This is needed in order to query both random and custom masks
          const { premium } = await browser.storage.local.get("premium");
          let getMasksOptions = { fetchCustomMasks: false };

          const missingPhonesPanelInit = () => {
            emailStatsPanel.classList.add("is-hidden");
            phonesStatsList.classList.add("is-hidden");
            statsHeader.classList.add("is-hidden");

            dynamicView.classList.remove("is-hidden");
            phonesStatsPanel.classList.remove("is-hidden");
          };

          const hasPhonesPanelInit = () => {
            emailStatsPanel.classList.add("is-hidden");
            dynamicView.classList.add("is-hidden");

            phonesStatsPanel.classList.remove("is-hidden");
            phonesStatsList.classList.remove("is-hidden");
            statsHeader.classList.remove("is-hidden");
          }; 

          // Show phone mask stats panel
          if (sessionState.primaryPanel === "phone-masks") {
            if (relayNumberData && realPhoneNumberData && realPhoneNumberData.verified) {
              hasPhonesPanelInit();
            } else {  
              missingPhonesPanelInit();
              // Show appropriate plan upgrade view
              popup.panel.phoneMasks.utils.setPhonesStatusView("stats");
              return;
            }

            const remainingMinutes = document.querySelector(".dashboard-stats.remaining-minutes");
            const remainingTexts = document.querySelector(".dashboard-stats.remaining-texts");
            const forwardedCallsTexts = document.querySelector(".dashboard-stats.forwarded-calls-texts");
            const blockedCallsTexts = document.querySelector(".dashboard-stats.blocked-calls-texts");
            
            remainingMinutes.textContent = relayNumberData.remaining_minutes;
            remainingTexts.textContent = relayNumberData.remaining_texts;
            forwardedCallsTexts.textContent = relayNumberData.calls_and_texts_forwarded;
            blockedCallsTexts.textContent =  relayNumberData.calls_and_texts_blocked;

            return;
          } 

          // Show emails stats panel
          phonesStatsPanel?.classList.add("is-hidden");
          emailStatsPanel?.classList.remove("is-hidden");

          if (premium) {
            // Check if user may have custom domain masks
            const { premiumSubdomainSet } = await browser.storage.local.get(
              "premiumSubdomainSet"
            );

            // API Note: If a user has not registered a subdomain yet, its default stored/queried value is "None";
            const isPremiumSubdomainSet = premiumSubdomainSet !== "None";
            getMasksOptions.fetchCustomMasks = isPremiumSubdomainSet;
          }

          // Use localStorage of Masks
          const { relayAddresses } = await browser.storage.local.get("relayAddresses");

           // Get Global Mask Stats data
          const totalAliasesUsedVal = relayAddresses.length;
          let totalEmailsForwardedVal = 0;
          let totalEmailsBlockedVal = 0;
          
          // Loop through all masks to calculate totals
          relayAddresses.forEach((mask) => {
            totalEmailsForwardedVal += mask.num_forwarded;
            totalEmailsBlockedVal += mask.num_blocked;
          });

          // Set global stats data 
          const globalStatSet = document.querySelector(".dashboard-stats-list.global-stats");
          const globalAliasesUsedValEl = globalStatSet.querySelector(".aliases-used");
          const globalEmailsBlockedValEl = globalStatSet.querySelector(".emails-blocked");
          const globalEmailsForwardedValEl = globalStatSet.querySelector(".emails-forwarded");

          globalAliasesUsedValEl.textContent = totalAliasesUsedVal;
          globalEmailsForwardedValEl.textContent = totalEmailsForwardedVal;
          globalEmailsBlockedValEl.textContent = totalEmailsBlockedVal;
         
          // Get current page
          const currentPageHostName = await browser.runtime.sendMessage({
            method: "getCurrentPageHostname",
          });

          // Check if any data applies to the current site
          if ( popup.utilities.checkIfAnyMasksWereGeneratedOnCurrentWebsite(relayAddresses,currentPageHostName) ) {
            
            // Some masks are used on the current site. Time to calculate!
            const filteredMasks = relayAddresses.filter(
              (mask) =>
                mask.generated_for === currentPageHostName ||
                popup.utilities.hasMaskBeenUsedOnCurrentSite(
                  mask,
                  currentPageHostName
                )
            );

            let currentWebsiteForwardedVal = 0;
            let currentWebsiteBlockedVal = 0;

            // Calculate forward/blocked counts
            filteredMasks.forEach((mask) => {
              currentWebsiteForwardedVal += mask.num_forwarded;
              currentWebsiteBlockedVal += mask.num_blocked;
            });

            // Set current website usage data
            const currentWebsiteStateSet = document.querySelector(".dashboard-stats-list.current-website-stats");

            const currentWebsiteAliasesUsedValEl = currentWebsiteStateSet.querySelector(".aliases-used");
            currentWebsiteAliasesUsedValEl.textContent = filteredMasks.length;

            const currentWebsiteEmailsForwardedValEl = currentWebsiteStateSet.querySelector(".emails-forwarded");
            currentWebsiteEmailsForwardedValEl.textContent = currentWebsiteForwardedVal;

            const currentWebsiteEmailsBlockedValEl = currentWebsiteStateSet.querySelector(".emails-blocked");
            currentWebsiteEmailsBlockedValEl.textContent = currentWebsiteBlockedVal;

            // If there's usage data for current website stats, show it
            const currentWebsiteEmailsBlocked = currentWebsiteStateSet.querySelector(".dashboard-info-emails-blocked");
            const currentWebsiteEmailsForwarded = currentWebsiteStateSet.querySelector(".dashboard-info-emails-forwarded");
            currentWebsiteEmailsBlocked.classList.remove("is-hidden");
            currentWebsiteEmailsForwarded.classList.remove("is-hidden");
            
          }
        },
      },
      survey: {
        init: async () => {
          const survey = popup.panel.survey;
          const surveyButtons = survey.select.surveyButtons();
          const { premium } = await browser.storage.local.get("premium");
          const tier = premium ? "premium" : "free";

          // loop through all satisfaction buttons
          surveyButtons.forEach(async (button) => {
            // check if button is disabled
            if (button.hasAttribute("disabled")) {
              // do nothing and exit early
              return;
            }

            // button is not disabled, add event listener
            button.addEventListener("click", async (e) => {
              e.preventDefault();

              const satisfaction = ["very dissatisfied", "dissatisfied", "neutral", "satisfied", "very satisfied"];
              const satisfactionLevel = e.target.dataset.satisfaction;

               // reset all buttons
               survey.utils.resetSurveyButtons();

              // user has chosen a satisfaction level
              // mark button as selected
              e.target.classList.add("is-selected");

              sendRelayEvent("CSAT Survey", "submitted", satisfaction[satisfactionLevel]); 
              
              // show success message
              survey.utils.showSurveySuccessMessage();

              // set correct survey link based on tier and satisfaction level
              survey.utils.setExternalSurveyLink(tier, satisfactionLevel);

              // show external survey link
              survey.utils.showSurveyExternalLink();
            });
          });
        },
        links: {
          // 0-4: Satisfaction levels
          // very dissatisfied, dissatisfied, neutral, satisfied, very satisfied
          free: {
            0: "https://survey.alchemer.com/s3/6665054/7a7bd09a1f5c", // Very Dissatisfied
            1: "https://survey.alchemer.com/s3/6665054/81559277cf08", // Dissatisfied
            2: "https://survey.alchemer.com/s3/6665054/bfd35b01db10", // Neutral
            3: "https://survey.alchemer.com/s3/6665054/ba5457f41c63", // Satisfied
            4: "https://survey.alchemer.com/s3/6665054/8a601f0da387", // Very Satisfied
          },
          premium: {
            0: "https://survey.alchemer.com/s3/6665054/7d42fcea7798", // Very Dissatisfied
            1: "https://survey.alchemer.com/s3/6665054/36db655e146f", // Dissatisfied
            2: "https://survey.alchemer.com/s3/6665054/865f28c68bd4", // Neutral
            3: "https://survey.alchemer.com/s3/6665054/4f963f89e498", // Satisfied
            4: "https://survey.alchemer.com/s3/6665054/2c8b192bd4c7", // Very Satisfied
          },
        },
        utils: {
          getExternalSurveyLink: (tier, satisfactionLevel) => {
            return popup.panel.survey.links[tier][satisfactionLevel];
          },
          setExternalSurveyLink: (tier, satisfactionLevel) => {
            const link = popup.panel.survey.utils.getExternalSurveyLink(
              tier,
              satisfactionLevel
            );

            popup.panel.survey.select
              .externalSurveyLink()
              .setAttribute("href", link);

            // set onclick for popup.panel.survey.select.externalSurveyLink()
            popup.panel.survey.select
              .externalSurveyLink()
              .addEventListener("click", (e) => {
                e.preventDefault();
 
                sendRelayEvent("CSAT Survey", "click", "panel-survey-external-link");
                
                // Open the URL in a new tab
                 browser.tabs.create({ url: link });

                // close panel after opening survey in new tab
                window.close();
              });
          },
          showSurveyLink: () => {
            popup.panel.survey.select
              .surveyLinkContainer()
              .classList.remove("is-hidden");
          },
          showSurveySuccessMessage: () => {
            popup.panel.survey.select
              .successMessage()
              .classList.remove("is-hidden");
          },
          showSurveyExternalLink: () => {
            popup.panel.survey.select
              .externalSurveyLink()
              .classList.remove("is-hidden");
          },
          closeSurveyLink: () => {
            popup.panel.survey.select
              .surveyLinkContainer()
              .classList.add("is-hidden");
          },
          resetSurveyButtons: () => {
            popup.panel.survey.select
              .surveyButtons()
              .forEach(
                (button) => button.classList.remove("is-selected"),
              );
          },
          useFirstSeen: async () => {
            const isLoggedIn = sessionState.loggedIn;
            const id = await browser.storage.local.get("profileID");

            if (!isLoggedIn || !id) {
              return null;
            }

            const firstSeenString = await popup.utilities.getStorageItem(
              "first_seen_" + id.profileID
            );
 
            if (typeof firstSeenString === "string") {
              return new Date(Number.parseInt(firstSeenString, 10));
            }

            const currentTimestamp = Date.now();

            await popup.utilities.setStorageItem(
              "first_seen_" + id.profileID,
              currentTimestamp.toString(),
              // expiration: (10 years * 365 days/year * 24 hours/day * 60 minutes/hour * 60 seconds/minute)
              10 * 365 * 24 * 60 * 60
            );

            return new Date(currentTimestamp);
          },
          getReasonToShowSurvey: async () => {
            let reasonToShow = null;
            const firstSeen = await popup.panel.survey.utils.useFirstSeen();
            const { premium } = await browser.storage.local.get("premium");
            const { profileID } = await browser.storage.local.get("profileID");
            const dismiss = popup.panel.survey.dismiss;
            const free1DayDismissal = await dismiss.free1DayDismissal(
              profileID
            );
            const free7DaysDismissal = await dismiss.free7DaysDismissal(
              profileID
            );
            const free30DaysDismissal = await dismiss.free30DaysDismissal(
              profileID
            );
            const free90DaysDismissal = await dismiss.free90DaysDismissal(
              profileID
            );
            const premium7DaysDismissal = await dismiss.premium7DaysDismissal(
              profileID
            );
            const premium30DaysDismissal = await dismiss.premium30DaysDismissal(
              profileID
            );
            const premium90DaysDismissal = await dismiss.premium90DaysDismissal(
              profileID
            );
            const { date_subscribed } = await browser.storage.local.get(
              "date_subscribed"
            );
            let isDismissed;

            if (premium && (date_subscribed || firstSeen instanceof Date)) {
              // There are two reasons why someone might not have a subscription date set:
              // - They subscribed before we started tracking that.
              // - They have Premium because they have a Mozilla email address.
              // In the latter case, their first visit date is effectively their
              // subscription date. In the former case, they will have had Premium for
              // a while, so they can be shown the survey too. Their first visit will
              // have been a while ago, so we'll just use that as a proxy for the
              // subscription date:
              const subscriptionDate = date_subscribed
                ? new Date(date_subscribed)
                : firstSeen;
              const daysSinceSubscription =
                (Date.now() - subscriptionDate.getTime()) / 1000 / 60 / 60 / 24;

              if (daysSinceSubscription >= 90) {
                isDismissed = await premium90DaysDismissal.isDismissed();
                if (!isDismissed) {
                  reasonToShow = "premium90days";
                }
              } else if (daysSinceSubscription >= 30) {
                isDismissed = await premium30DaysDismissal.isDismissed();
                if (!isDismissed) {
                  reasonToShow = "premium30days";
                }
              } else if (daysSinceSubscription >= 7) {
                isDismissed = await premium7DaysDismissal.isDismissed();
                if (!isDismissed) {
                  reasonToShow = "premium7days";
                }
              }
            } else if (!premium && firstSeen instanceof Date) {
              const daysSinceFirstSeen =
                (Date.now() - firstSeen.getTime()) / 1000 / 60 / 60 / 24;

              if (daysSinceFirstSeen >= 90) {
                isDismissed = await free90DaysDismissal.isDismissed();
                if (!isDismissed) {
                  reasonToShow = "free90days";
                }
              } else if (daysSinceFirstSeen >= 30) {
                isDismissed = await free30DaysDismissal.isDismissed();
                if (!isDismissed) {
                  reasonToShow = "free30days";
                }
              } else if (daysSinceFirstSeen >= 7) {
                isDismissed = await free7DaysDismissal.isDismissed();
                if (!isDismissed) {
                  reasonToShow = "free7days";
                }
              } else if (daysSinceFirstSeen > 1) {
                isDismissed = await free1DayDismissal.isDismissed();
                if (!isDismissed) {
                  reasonToShow = "free1day";
                }
              }
            }

            return reasonToShow;
          },
          shouldShowSurvey: async () => {
            const reasonToShow = await popup.panel.survey.utils.getReasonToShowSurvey();
            const locale = browser.i18n.getUILanguage()

            return (
              reasonToShow !== null &&
              ["en", "fr", "de"].includes(locale.split("-")[0])
            );
          },
        },
        dismiss: {
          // dismissals are keyed by the profile ID
          free1DayDismissal: (id) => popup.utilities.localDismiss("csat-survey-free-1day_" + id),
          free7DaysDismissal: (id) => popup.utilities.localDismiss("csat-survey-free-7days_" + id),
          free30DaysDismissal: (id) => popup.utilities.localDismiss("csat-survey-free-30days_" + id),
          free90DaysDismissal: (id) => popup.utilities.localDismiss(
              "csat-survey-free-90days_" + id,
              // After the third month, show every three months:
              { duration: 90 * 24 * 60 * 60 }
            ),
          premium7DaysDismissal: (id) => popup.utilities.localDismiss("csat-survey-premium-7days_" + id),
          premium30DaysDismissal: (id) => popup.utilities.localDismiss("csat-survey-premium-30days_" + id),
          premium90DaysDismissal: (id) => popup.utilities.localDismiss(
              "csat-survey-premium-90days_" + id,
              // After the third month, show every three months:
              { duration: 90 * 24 * 60 * 60 }
            ),
        },
        select: {
          // storing as functions to avoid caching
          surveyLinkContainer: () => document.querySelector(".fx-relay-csat-survey-link-container"),
          viewSurveyLinkButton: () => document.querySelector(".fx-relay-csat-survey-view-icon"),
          surveyLink: () => document.querySelector(".fx-relay-csat-survey-link"),
          surveyButtons: () => document.querySelectorAll(".fx-relay-csat-button"),
          successMessage: () => document.querySelector(".fx-relay-survey-success"),
          surveyDismiss: () => document.querySelector(".fx-relay-survey-dismiss"),
          externalSurveyLink: () => document.querySelector(".fx-relay-external-survey-link"),
        }
      },
      webcompat: {
        handleReportIssueFormSubmission: async (event, formData) => {          
          event.preventDefault();

          formData = popup.panel.webcompat.getFormData();

          // Do not submit if the form is not valid
          if (!formData.form.dataset.formIsValid) {
            return false;
          }

          formData.reportIssueSubmitBtn.classList.toggle("is-loading");
          
          const data = new FormData(event.target);
          const reportData = Object.fromEntries(data.entries());
          reportData.user_agent = await getBrowser();

          Object.keys(reportData).forEach(function (value) {
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
          if (
            !(
              reportData.issue_on_domain.startsWith("http://") ||
              reportData.issue_on_domain.startsWith("https://")
            )
          ) {
            reportData.issue_on_domain = "http://" + reportData.issue_on_domain;
          }

          // Send data and get a status code back
          const postReportWebcompatIssueRespStatus = await browser.runtime.sendMessage({
            method: "postReportWebcompatIssue",
            description: reportData,
          });
          
          // If submission is successful
          if (postReportWebcompatIssueRespStatus == 201) {
            popup.panel.webcompat.showSuccessReportSubmission(formData);
            formData.reportIssueSubmitBtn.classList.remove("is-loading");
          } else {
            // TODO: Add localized error state
            formData.reportIssueSubmitBtn.classList.remove("is-loading");
            formData.reportIssueSubmitBtn.classList.add("t-error");
          }
        },
        init: () => {
          const formData = popup.panel.webcompat.getFormData();
          
          // Set the form as invalid
          formData.form.dataset.formIsValid = false;
          
          popup.panel.webcompat.setURLwithIssue(formData);
          popup.panel.webcompat.setCheckboxListeners(formData);
          popup.panel.webcompat.showReportInputOtherTextField(formData);
          
          formData.form.addEventListener("submit", popup.panel.webcompat.handleReportIssueFormSubmission);

          // When clicking the "Continue" button after successfully submitting the webcompat form,
          // Reset the form and show the settings page again
          formData.reportIssueSuccessDismissBtn.addEventListener("click", popup.events.backClick, false);
        },
        getFormData: () => {
          const formData = {
            form: document.querySelector(".report-issue-content"),
            reportIssueSubmitBtn: document.querySelector(".report-issue-submit-btn"),
            reportIssueSuccessDismissBtn: document.querySelector(".report-continue"),
            inputFieldUrl: document.querySelector('input[name="issue_on_domain"]'),
            inputFieldOtherDetails: document.querySelector('input[name="other_issue"]'),
            checkboxes: document.querySelectorAll('.report-section ul li input'),
            reportSuccess: document.querySelector('.report-success'),
            otherTextField: document.querySelector('input[name="other_issue"]'),
            otherCheckbox: document.querySelector('input[name="issue-case-other"]'),
          }

          return formData;
        },        
        setCheckboxListeners: (formData) => {
          const checkboxes = formData.checkboxes;
          
          checkboxes.forEach(checkbox => {
            checkbox.addEventListener("change", ()=> {              
              popup.panel.webcompat.validateForm(formData);
            })
          });
        },
        setURLwithIssue: async (formData) => {
          // Add Site URL placeholder
          const currentPage = (await popup.utilities.getCurrentPage()).url;
          const inputFieldUrl = formData.inputFieldUrl;

          // Allow for custom URL inputs
          inputFieldUrl.addEventListener("input", () => {
            popup.panel.webcompat.validateForm(formData);
          });

          // Check that the host site has a valid URL
          if (currentPage) {
            const url = new URL(currentPage);
            // returns a http:// or https:// value
            inputFieldUrl.value = url.origin;
          }

          // Check if form is valid
          popup.panel.webcompat.validateForm(formData);
        },
        showReportInputOtherTextField: (formData) => {
          const otherCheckbox = formData.otherCheckbox;
          const otherTextField = formData.otherTextField;

          // Show the hidden "OTHER" field, make it required and check if the form is valid
          otherCheckbox.addEventListener("click", () => {
            otherTextField.classList.toggle("is-hidden");
            otherTextField.required = !otherTextField.required;
            popup.panel.webcompat.validateForm(formData);
          });

          // Add placeholder to report input on 'Other' selection
          const inputFieldOtherDetails = formData.inputFieldOtherDetails;

          // Allow for custom URL inputs
          inputFieldOtherDetails.addEventListener("input", () => {
            popup.panel.webcompat.validateForm(formData);
          });

          inputFieldOtherDetails.placeholder = browser.i18n.getMessage(
            "popupReportIssueCaseOtherDetails"
          );
        },
        showSuccessReportSubmission: (formData) => {
          const reportSuccess = formData.reportSuccess;
          const reportContent = formData.form
          reportSuccess.classList.remove("is-hidden");
          reportContent.classList.add("is-hidden");          
        },
        validateForm: (formData) => {
          // Check if inputFieldUrl is valid and the custom input looks like a URL 
          // without https:// or http:// (e.g. test.com, www.test.com) 
          const inputFieldUrlIsValid = formData.inputFieldUrl.checkValidity() && popup.utilities.isSortaAURL(formData.inputFieldUrl.value);

          // Validate that at least one checkbox is checked
          const checkboxes = formData.checkboxes
          const isACheckBoxChecked = [...checkboxes].some(e => e.checked == true);

          // If the "other" checkbox is checked, confirm the "other" input is valid
          const checkedCheckboxes = [...checkboxes].filter(e => e.checked == true);          
          const isCheckedCheckboxOther = checkedCheckboxes.some(e => e.id == "issue-case-other");
          const inputFieldOtherDetailsIsValid = formData.inputFieldOtherDetails.checkValidity();

          // This tests for two possible valid form states: 
          // A: User has URL field filled out correctly AND at least one reason checkbox checked (Not OTHER checkbox)
          // B: User has URL field filled out correctly AND has checked the OTHER checbox AND filled out the other input form correctly
          if (
              (inputFieldUrlIsValid && isACheckBoxChecked && !isCheckedCheckboxOther) || 
              (inputFieldUrlIsValid && isACheckBoxChecked && isCheckedCheckboxOther && inputFieldOtherDetailsIsValid) 
          ) {
            formData.reportIssueSubmitBtn.disabled = false;
            formData.form.dataset.formIsValid = true;
            return;
          }
          
          // Default / Set Disabled
          formData.reportIssueSubmitBtn.disabled = true;
          formData.form.dataset.formIsValid = false;
        },

      },
    },
    utilities: {
      isNumberDataValid: (relayNumberData) => {
        return relayNumberData && relayNumberData.length !== 0 ? relayNumberData[0] : false;
      },
      setPrimaryPanel: (panelId) => {
        // Show the tabs and the footers in a primary panel
        document.querySelector(".fx-relay-primary-dashboard-switcher")?.classList.remove("is-hidden")
        document.querySelector(".fx-relay-menu-dashboard-link.footer")?.classList.remove("is-hidden");
        sessionState.primaryPanel = panelId;
      },
      buildBackButton: (navId, navLevel, backTarget) => {
        let button = document.createElement("button");
        let goBackText = document.createElement("span");
        let img = document.createElement("img");

        button.setAttribute("data-nav-id", navId);
        button.setAttribute("data-nav-level", navLevel);
        button.setAttribute("data-back-target", backTarget);
        button.className = "fx-relay-menu-dashboard-link footer js-internal-link fx-relay-panel-header-btn-back";
      
        goBackText.className = "i18n-content";
        goBackText.setAttribute("data-i18n-message-id", "goBackText");
        goBackText.textContent = browser.i18n.getMessage("goBackText");

        img.className = "i18n-alt-tag";
        img.setAttribute("data-i18n-message-id", "returnToPreviousPanel");
        img.src = "/icons/nebula-back-arrow.svg";
        img.alt = "";

        button.appendChild(img);
        button.appendChild(goBackText);
        
        button.addEventListener("click", popup.events.backClick, false);
        
        let footer = document.querySelector(".fx-relay-footer-nav");
        footer?.appendChild(button);
        footer?.classList.add('left-align');
      },
      checkIfAnyMasksWereGeneratedOnCurrentWebsite: (masks, domain) => {
        return masks.some((mask) => {
          return domain === mask.generated_for;
        });
      },
      clearBrowserActionBadge: async () => {
        const { browserActionBadgesClicked } = await browser.storage.local.get("browserActionBadgesClicked");

        // Dismiss the browserActionBadge only when it exists
        if (browserActionBadgesClicked === false) {
          browser.storage.local.set({ browserActionBadgesClicked: true });
          browser.browserAction.setBadgeBackgroundColor({ color: null });
          browser.browserAction.setBadgeText({ text: "" });
        }
      },
      enableInputIconDisabling: async () => {
        const inputIconVisibilityToggle = document.querySelector(
          ".toggle-icon-in-page-visibility"
        );

        const stylePrefToggle = (inputsEnabled) => {
          if (inputsEnabled === "show-input-icons") {
            inputIconVisibilityToggle.dataset.iconVisibilityOption =
              "disable-input-icon";
            inputIconVisibilityToggle.classList.remove("input-icons-disabled");
            return;
          }
          inputIconVisibilityToggle.dataset.iconVisibilityOption =
            "enable-input-icon";
          inputIconVisibilityToggle.classList.add("input-icons-disabled");
        };

        const iconsAreEnabled = await areInputIconsEnabled();
        const userIconChoice = iconsAreEnabled
          ? "show-input-icons"
          : "hide-input-icons";
        stylePrefToggle(userIconChoice);

        inputIconVisibilityToggle.addEventListener("click", async () => {
          const userIconPreference =
            inputIconVisibilityToggle.dataset.iconVisibilityOption ===
            "disable-input-icon"
              ? "hide-input-icons"
              : "show-input-icons";
          browser.runtime.sendMessage({
            method: "updateInputIconPref",
            iconPref: userIconPreference,
          });
          sendRelayEvent("Panel", "click", userIconPreference);
          return stylePrefToggle(userIconPreference);
        });
      },
      hasMaskBeenUsedOnCurrentSite: (mask, domain) => {
        const domainList = mask.used_on;

        // Short circuit out if there's no used_on entry
        if ([undefined, null, ""].includes(domainList)) {
          return false;
        }

        // Domain already exists in used_on field. Just return the list!
        if (domainList.split(",").includes(domain)) {
          return true;
        }

        // No match found!
        return false;
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

        // MPP-2857: During upgrade, the profile ID may be dropped, so if that is not 
        // available to the add-on, prompt the user to reauthenticate
        const { profileID } = await browser.storage.local.get("profileID");

        if (!profileID) {
          return false;
        }
        
        return signedInUser;
      },
      getCachedServerStoragePref: async () => {
        const serverStoragePref = await browser.storage.local.get(
          "server_storage"
        );
        const serverStoragePrefInLocalStorage =
          Object.prototype.hasOwnProperty.call(
            serverStoragePref,
            "server_storage"
          );

        if (!serverStoragePrefInLocalStorage) {
          // There is no reference to the users storage preference saved. Fetch it from the server.
          return await browser.runtime.sendMessage({
            method: "getServerStoragePref",
          });
        } else {
          // If the stored pref exists, return value
          return serverStoragePref.server_storage;
        }
      },
      getCurrentPage: async () => {
        const [currentTab] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        return currentTab;
      },
      getMasks: async (options = { fetchCustomMasks: false }) => {
        const serverStoragePref =
          await popup.utilities.getCachedServerStoragePref();

        if (serverStoragePref) {
          try {
            return await browser.runtime.sendMessage({
              method: "getAliasesFromServer",
              options,
            });
          } catch (error) {
            console.warn(`getAliasesFromServer Error: ${error}`);

            // API Error — Fallback to local storage
            const { relayAddresses } = await browser.storage.local.get(
              "relayAddresses"
            );

            return relayAddresses;
          }
        }

        // User is not syncing with the server. Use local storage.
        const { relayAddresses } = await browser.storage.local.get("relayAddresses");
        return relayAddresses;
      },
      populateNewsFeed: async ()=> {
        // audience can be premium, free, phones, all
        // Optional data: waffle, fullCta*
        const savings = "40%"; // For "Save 40%!" in the Bundle promo body
        
        const isBundleAvailableInCountry = (await browser.storage.local.get("bundlePlans")).bundlePlans.BUNDLE_PLANS.available_in_country;
        const isPhoneAvailableInCountry = (await browser.storage.local.get("phonePlans")).phonePlans.PHONE_PLANS.available_in_country;
        const hasPhone = (await browser.storage.local.get("has_phone")).has_phone;
        const hasVpn = (await browser.storage.local.get("has_vpn")).has_vpn;

        // Conditions for phone masking announcement to be shown: if the user is in US/CAN, phone flag is on, and user has not purchased phone plan yet
        const isPhoneMaskingAvailable = isPhoneAvailableInCountry && !hasPhone;

        // Conditions for bundle announcement to be shown: if the user is in US/CAN, bundle flag is on, and user has not purchased bundle plan yet
        const isBundleAvailable = isBundleAvailableInCountry && !hasVpn;
      
        // Conditions for firefox integration to be shown: if the waffle flag "firefox_integration" is set as true
        const isFirefoxIntegrationAvailable = await checkWaffleFlag("firefox_integration");
        
        const currentBrowser = await getBrowser();
        const isEuCountryExpansion = await checkWaffleFlag(
          "eu_country_expansion"
        );
        const getPeriodicalPremiumPlans = (await browser.storage.local.get("periodicalPremiumPlans")).periodicalPremiumPlans.PERIODICAL_PREMIUM_PLANS;
        const getPeriodicalPremiumProductId = (await browser.storage.local.get("periodicalPremiumProductId")).periodicalPremiumProductId.PERIODICAL_PREMIUM_PRODUCT_ID;
        const premiumAvailability = getPeriodicalPremiumPlans.available_in_country;
        const countryCode = getPeriodicalPremiumPlans.country_code;
        const premium = (await browser.storage.local.get("premium")).premium;
        const isHolidayPromo2023Available = await checkWaffleFlag(
          "holiday_promo_2023"
        );

        if (
          !premium &&
          isEuCountryExpansion &&
          [
            "bg",
            "cz",
            "cy",
            "dk",
            "ee",
            "gr",
            "hr",
            "hu",
            "lt",
            "lv",
            "lu",
            "mt",
            "pl",
            "pt",
            "ro",
            "si",
            "sk",
          ].includes(
            countryCode
          )
        ) {
          sessionState.newsContent.push({
            id: "eu-country-expansion",
            dateAdded: "20230726", // YYYYMMDD
            waffle: "eu_country_expansion",
            locale: "us",
            audience: "free",
            headlineString: "popupEuCountryExpansionHeadline",
            bodyString: "popupEuCountryExpansionBody",
            teaserImg:
              "/images/panel-images/announcements/panel-announcement-eu-expansion-square-illustration.svg",
            fullImg:
              "/images/panel-images/announcements/panel-announcement-eu-expansion-illustration.svg",
            fullCta: "popupEuCountryExpansionPromoCTA",
            fullCtaRelayURL: true,
            fullCtaHref:
              "/premium/?utm_source=fx-relay-addon&utm_medium=popup&utm_content=panel-news-eu-country-expansion-cta#pricing",
            fullCtaEventLabel: "panel-news-eu-country-expansion-cta",
            fullCtaEventAction: "click",
          });
        }

        if (isFirefoxIntegrationAvailable && currentBrowser == "Firefox") {
          sessionState.newsContent.push({
            id: "firefox-integration",
            dateAdded: "20230314", // YYYYMMDD
            waffle: "firefox_integration",
            locale: "us",
            audience: "premium",
            headlineString: "popupPasswordManagerRelayHeadline",
            bodyString: "popupPasswordManagerRelayBody",
            teaserImg:
              "/images/panel-images/announcements/panel-announcement-password-manager-relay-square-illustration.svg",
            fullImg:
              "/images/panel-images/announcements/panel-announcement-password-manager-relay-illustration.svg",
          });
        }

        // Add Phone Masking News Item
        if (isPhoneMaskingAvailable) {
          sessionState.newsContent.push({
            id: "phones",
            dateAdded: "20221006", // YYYYMMDD
            headlineString: "popupPhoneMaskingPromoHeadline",
            bodyString: "popupPhoneMaskingPromoBody",
            teaserImg:
              "/images/panel-images/announcements/premium-announcement-phone-masking.svg",
            fullImg:
              "/images/panel-images/announcements/premium-announcement-phone-masking-hero.svg",
            fullCta: "popupPhoneMaskingPromoCTA",
            fullCtaRelayURL: true,
            fullCtaHref:
              "/premium/?utm_source=fx-relay-addon&utm_medium=popup&utm_content=panel-news-phone-masking-cta#pricing",
            fullCtaEventLabel: "panel-news-phone-masking-cta",
            fullCtaEventAction: "click",
          });
        }

        // Add Bundle Pricing News Item
        if (isBundleAvailable) {
          const getBundlePlans = (await browser.storage.local.get("bundlePlans")).bundlePlans.BUNDLE_PLANS;
          const getBundlePrice = getBundlePlans.plan_country_lang_mapping[getBundlePlans.country_code]["*"].yearly.price;
          const getBundleCurrency = getBundlePlans.plan_country_lang_mapping[getBundlePlans.country_code]["*"].yearly.currency;
          const userLocale = navigator.language;
          const formattedBundlePrice = new Intl.NumberFormat(userLocale, {
            style: "currency",
            currency: getBundleCurrency,
          }).format(getBundlePrice);
          
          sessionState.newsContent.push({
            id: "mozilla-vpn-bundle",
            dateAdded: "20221025", // YYYYMMDD
            headlineString: "popupBundlePromoHeadline_2",
            headlineStringArgs: savings,
            bodyString: "popupBundlePromoBody_3",
            bodyStringArgs: formattedBundlePrice,
            teaserImg:
              "/images/panel-images/announcements/panel-bundle-announcement-square.svg",
            fullImg:
              "/images/panel-images/announcements/panel-bundle-announcement.svg",
            fullCta: "popupPhoneMaskingPromoCTA",
            fullCtaRelayURL: true,
            fullCtaHref:
              "/premium/?utm_source=fx-relay-addon&utm_medium=popup&utm_content=panel-news-bundle-cta#pricing",
            fullCtaEventLabel: "panel-news-bundle-cta",
            fullCtaEventAction: "click",
          },)
        }

        const currentDate = new Date();
        const holidayPromoExpires = new Date('2023-12-31');
        const isHolidayPromo2023Active = currentDate <= holidayPromoExpires;

        // Show if promo is available, if user does not have premium, if active and if premium is availble in user's region
        if (isHolidayPromo2023Available && !premium && isHolidayPromo2023Active && premiumAvailability) {
          const getPeriodicalPremiumPlanYearlyId = getPeriodicalPremiumPlans.plan_country_lang_mapping[getPeriodicalPremiumPlans.country_code]["*"].yearly.id;
          const fxaOrigin = (await browser.storage.local.get("fxaOrigin")).fxaOrigin.FXA_ORIGIN;
          const holidayPromo2023Url =  `${fxaOrigin}/subscriptions/products/${getPeriodicalPremiumProductId}?plan=${getPeriodicalPremiumPlanYearlyId}&coupon=HOLIDAY20&utm_campaign=relay-holiday-promo-2023&utm_source=fx-relay-addon&utm_medium=popup&utm_content=panel-news-holiday-promo-2023-cta`;

          sessionState.newsContent.push({
            id: "holiday-promo-2023",
            dateAdded: "20231121", // YYYYMMDD
            waffle: "holiday_promo_2023",
            locale: "us",
            audience: "free",
            headlineString: "popupHolidayPromo2023Headline",
            bodyString: "popupHolidayPromo2023Body",
            teaserImg:
              "/images/panel-images/announcements/panel-announcement-holiday-promo-2023-square-illustration.svg",
            fullImg:
              "/images/panel-images/announcements/panel-announcement-holiday-promo-2023-illustration.svg",
            fullCta: "popupHolidayPromo2023CTA",
            fullCtaRelayURL: false,
            fullCtaHref: holidayPromo2023Url,
            fullCtaEventLabel: "panel-news-holiday-promo-2023-cta",
            fullCtaEventAction: "click",
          });
        }

        // Remove news nav link if there's no news items to display to user
        if (sessionState.newsContent.length === 0 ) {
          document.querySelector(".fx-relay-menu-dashboard-link[data-panel-id='news']").remove();
          return;
        }
        
        // Sort news items by dateAdded field (Newest at the top)
        sessionState.newsContent.sort((a, b) => (a.dateAdded < b.dateAdded ? 1 : -1));

        // Update news item count
        sessionState.newsItemsCount = sessionState.newsContent.length;

        // Set unread notification count
        // TODO: Move some of this logic to get_profile_data to set the browserActionBadge to a #
        await popup.panel.news.utilities.initNewsItemCountNotification();
      },
      setExternalLinkEventListeners: async () => {
        const externalLinks = document.querySelectorAll(".js-external-link");
        const currentBrowser = await getBrowser();

        externalLinks.forEach((link) => {          
          // Because we dynamically set the Relay origin URL (local/dev/stage/prod),
          // we have to catch Relay-specific links and prepend the correct Relay website URL
          if (link.dataset.relayInternal === "true") {
            // TODO: Remove "/" from here. It'll be error prone
            link.href = `${relaySiteOrigin}/${link.dataset.href}`;
          } else if (link.dataset.hrefChrome && currentBrowser == "Chrome") {
            // Override to link to a Chrome-specific link (Example: "Leave Feedback" link)
            link.href = `${link.dataset.hrefChrome}`;
          } else {
            link.href = `${link.dataset.href}`;
          }

          link.addEventListener("click", popup.events.externalClick, false);
        });
      },
      unhideNavigationItemsOnceLoggedIn: () => {
        document
          .querySelectorAll(".fx-relay-menu-dashboard-link.is-hidden")
          .forEach((link) => {
            link.classList.remove("is-hidden");
          });
      },
      getStorageItem: async (key) => {
        const result = await browser.storage.local.get(key);
        const item = result[key];
        if (
          item &&
          item.expirationTime &&
          item.expirationTime < new Date().getTime()
        ) {
          await browser.storage.local.remove(key);
          return undefined;
        }
        return item?.value;
      },
      setStorageItem: async (key, value, expirationTimeInMinutes) => {
        const expirationTimeInMillis = expirationTimeInMinutes * 60 * 1000;
        const item = {
          value: value,
          expirationTime: new Date().getTime() + expirationTimeInMillis,
        };
        await browser.storage.local.set({ [key]: item });
      }, 
      localDismiss: (key) => {
        const storageId = key + "_dismissed";

        const isDismissed = async () => {
          let dismissedTime = await browser.storage.local.get(storageId);
          if (dismissedTime[storageId]) {
            const currentTime = Date.now();
            const elapsedTime = currentTime - dismissedTime[storageId].value;
            const maxAge = dismissedTime[storageId].duration || (100 * 365 * 24 * 60 * 60 * 1000); // Default to 100 years if duration is not set
        
            return elapsedTime < maxAge;
          }
          return false;
        };

        const dismiss = async (dismissOptions = {}) => {
          const currentTime = Date.now();
          let dismissedTime = {
            value: currentTime,
            duration: storageId.includes("90day") ? 90 * 24 * 60 * 60 * 1000 : undefined // this provides us the recurring 90 day dismissal
          };
        
          await browser.storage.local.set({ [storageId]: dismissedTime });
          if (dismissOptions.soft !== true) {
            return true; // Indicating it's dismissed
          }
          return await isDismissed();
        };

        return {
            isDismissed: isDismissed,
            dismiss: dismiss
        };
      }, 
      dismissByReason: (reasonToShow, profileID) => {
        const dismissalMapping = {
          "free90days": popup.panel.survey.dismiss.free90DaysDismissal,
          "free30days": popup.panel.survey.dismiss.free30DaysDismissal,
          "free7days": popup.panel.survey.dismiss.free7DaysDismissal,
          "free1day": popup.panel.survey.dismiss.free1DayDismissal,
          "premium90days": popup.panel.survey.dismiss.premium90DaysDismissal,
          "premium30days": popup.panel.survey.dismiss.premium30DaysDismissal,
          "premium7days": popup.panel.survey.dismiss.premium7DaysDismissal
      };
  
      const dismissalFunction = dismissalMapping[reasonToShow];
      if (dismissalFunction) {
          const dismissalInstance = dismissalFunction(profileID);
          dismissalInstance.dismiss();
      } 
     },
    },
    ariaControls: {
      setSelected: (element) => {
        if (!(element instanceof Element)) {
          return;
        }
        const prevSelected = document.querySelector("[aria-selected]");
        prevSelected.removeAttribute("aria-selected");

        element.setAttribute("aria-selected", true);

      },
      setControls: (element, panelId) => {
        if (!(element instanceof Element) || !(typeof panelId === 'string')) {
          return;
        }
        const prevSelected = document.querySelector("[aria-controls]");
        prevSelected.removeAttribute("aria-controls");

        element.setAttribute("aria-controls", panelId);
      }
    },
  };

  popup.init();
})();
