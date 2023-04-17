/* global getBrowser checkWaffleFlag psl */

(async () => {
  // Global Data
  const { relaySiteOrigin } = await browser.storage.local.get(
    "relaySiteOrigin"
  );

  const sessionState = {
    currentPanel: null,
    newsItemsCount: null,
    loggedIn: false,
    newsContent: []
  };

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

        // Catch back button clicks if the user is logged out
        if (!sessionState.loggedIn && backNavLevel === "root") {
          popup.panel.update("sign-up");
          return;
        }

        popup.panel.update(backTarget);
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
        e.target.classList.add("is-active");
        const panelId = e.target.dataset.panelId;
        popup.panel.update(panelId);
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

          await popup.panel.masks.utilities.buildMasksList(null, {newMaskCreated: false});
          
          return;
        }

        event.target.classList.remove("is-loading");

        // Hide onboarding panel
        const noMasksCreatedPanel = document.querySelector(".fx-relay-no-masks-created");
        noMasksCreatedPanel.classList.add("is-hidden");

        await popup.panel.masks.utilities.buildMasksList(null, {newMaskCreated: true});

        
        if (!premium) {
          console.log("maskcall");
          await popup.panel.masks.utilities.setRemainingMaskCount();
        }

      }
    },
    init: async () => {
      // Set Navigation Listeners
      const navigationButtons = document.querySelectorAll(".js-internal-link");
      navigationButtons.forEach((button) => {
        button.addEventListener("click", popup.events.navigationClick, false);
      });

      // Set Back Button Listeners
      const backButtons = document.querySelectorAll(
        ".fx-relay-panel-header-btn-back"
      );
      
      backButtons.forEach((button) => {
        button.addEventListener("click", popup.events.backClick, false);
      });

      sessionState.loggedIn = await popup.utilities.isUserSignedIn();

      // Check if user is signed in to show default/sign-in panel
      if (sessionState.loggedIn) {
        popup.panel.update("masks");
        popup.utilities.unhideNavigationItemsOnceLoggedIn();
        // populateNewsFeed Also sets Notification Bug for Unread News Items
        popup.utilities.populateNewsFeed();
      } else {
        popup.panel.update("sign-up");
        document.body.classList.remove("is-loading");
      }

      // Set External Event Listerners
      await popup.utilities.setExternalLinkEventListeners();

      // Note: There's a chain of functions that run from init, and end with putting focus on the most reasonable element: 
      // Cases:
      //   If not logged in: focused on "Sign In" button
      //   (Both tiers) If no masks made: focused on primary generate mask button
      //   If free tier: focused on "Create mask" button
      //   If premium tier: focused in search bar
    },
    panel: {
      update: (panelId, data) => {
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
        switch (panelId) {
          case "custom": 
            popup.panel.masks.custom.init();
            break;

          case "masks": 
            popup.panel.masks.init();
            break;

          case "news":
            sendRelayEvent("Panel", "click", "opened-news");
            popup.panel.news.init();
            popup.panel.news.utilities.updateNewsItemCountNotification(true);
            break;

          case "newsItem":
            sendRelayEvent("Panel", "click", "opened-news-item");
            popup.panel.news.item.update(data.newsItemId);
            break;

          case "settings":
            sendRelayEvent("Panel", "click", "opened-settings");
            popup.panel.settings.init();
            break;

          case "stats":
            sendRelayEvent("Panel", "click", "opened-stats");
            popup.panel.stats.init();
            break;

          case "webcompat":
            sendRelayEvent("Panel", "click", "opened-report-issue");
            popup.panel.webcompat.init();
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
          const maskPanel = document.getElementById("masks-panel");
          const { relayAddresses } = await browser.storage.local.get("relayAddresses");

          let getMasksOptions = { fetchCustomMasks: false, updateLocalMasks: false, source: "masks.init" };
          
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
          
          // Get masks and determine what to display
          // FIXME: Figure out correct Order of Ops to fetch masks only once
          // const masks = await popup.utilities.getMasks(getMasksOptions);

          // If no masks are created, show onboarding prompt
          if (relayAddresses.length === 0) {
            const noMasksCreatedPanel = document.querySelector(".fx-relay-no-masks-created");
            noMasksCreatedPanel.classList.remove("is-hidden");
          }

          // Build initial list based on local storage
          // Note: If premium, buildMasksList runs `popup.panel.masks.search.init()` after completing
          popup.panel.masks.utilities.buildMasksList(relayAddresses);
        

          // Remove loading state
          document.body.classList.remove("is-loading");

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
          buildMasksList: async (localMasks = null, opts = null, remoteMasks = null) => {
            let getMasksOptions = { fetchCustomMasks: false, updateLocalMasks: false, source: "utils.buildMasksList"  };
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
            
            const masks = localMasks;
            let masksFromApi = remoteMasks;

            if (!remoteMasks) {
              console.log("No remote mask arg passed");
              // masksFromApi = await popup.utilities.getMasks(getMasksOptions, {updateLocalMasks: true});
            }
          
            const { hashOfLocalStorageMasks } = await browser.storage.local.get("hashOfLocalStorageMasks");
            const { hashOfRemoteServerMasks } = await browser.storage.local.get("hashOfRemoteServerMasks");

            const maskList = document.querySelector(".fx-relay-mask-list");
            // Reset mask list
            maskList.textContent = "";

            masks.forEach(mask => {
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
              maskListItem.appendChild(maskListItemNewMaskCreatedLabel);
              
              const maskListItemAddressBar = document.createElement("div");
              maskListItemAddressBar.classList.add("fx-relay-mask-item-address-bar");

              const maskListItemAddressWrapper = document.createElement("div");
              maskListItemAddressWrapper.classList.add("fx-relay-mask-item-address-wrapper");

              const maskListItemLabel = document.createElement("span");
              maskListItemLabel.classList.add("fx-relay-mask-item-label");
              maskListItemLabel.textContent = mask.description;
              
              // Append Label if it exists
              if (mask.description !== "") {
                maskListItemAddressWrapper.appendChild(maskListItemLabel);
              }
              
              const maskListItemAddress = document.createElement("div");
              maskListItemAddress.classList.add("fx-relay-mask-item-address");
              maskListItemAddress.textContent = mask.full_address;
              maskListItemAddressWrapper.appendChild(maskListItemAddress);

              // Add Mask Address Bar Contents 
              maskListItemAddressBar.appendChild(maskListItemAddressWrapper);

              const maskListItemAddressActions = document.createElement("div");
              maskListItemAddressActions.classList.add("fx-relay-mask-item-address-actions");

              const maskListItemCopyButton = document.createElement("button");
              maskListItemCopyButton.classList.add("fx-relay-mask-item-address-copy");
              maskListItemCopyButton.setAttribute("data-mask-address", mask.full_address);

              const maskListItemCopyButtonSuccessMessage = document.createElement("span");
              maskListItemCopyButtonSuccessMessage.textContent = browser.i18n.getMessage("popupCopyMaskButtonCopied");
              maskListItemCopyButtonSuccessMessage.classList.add("fx-relay-mask-item-address-copy-success");
              maskListItemAddressActions.appendChild(maskListItemCopyButtonSuccessMessage);
              
              maskListItemCopyButton.addEventListener("click", (e)=> {
                e.preventDefault();
                navigator.clipboard.writeText(e.target.dataset.maskAddress);
                maskListItemCopyButtonSuccessMessage.classList.add("is-shown");
                setTimeout(() => {
                  maskListItemCopyButtonSuccessMessage.classList.remove("is-shown")
                }, 1000);
              }, false);
              maskListItemAddressActions.appendChild(maskListItemCopyButton);

              const maskListItemToggleButton = document.createElement("button");
              maskListItemToggleButton.classList.add("fx-relay-mask-item-address-toggle");
              maskListItemToggleButton.addEventListener("click", ()=> {
                // TODO: Add Toggle Function
              }, false);
              maskListItemToggleButton.setAttribute("data-mask-id", mask.id);
              maskListItemToggleButton.setAttribute("data-mask-type", mask.mask_type);
              maskListItemToggleButton.setAttribute("data-mask-address", mask.full_address);

              // TODO: Add toggle button back
              // maskListItemAddressActions.appendChild(maskListItemToggleButton);

              maskListItemAddressBar.appendChild(maskListItemAddressActions);
              maskListItem.appendChild(maskListItemAddressBar);
              maskList.appendChild(maskListItem);
            });

            // Display "Mask created" temporary label when a new mask is created in the panel
            if (opts && opts.newMaskCreated && maskList.firstElementChild) {
              maskList.firstElementChild.classList.add("is-new-mask");

              setTimeout(() => {
                maskList.firstElementChild.classList.remove("is-new-mask");
              }, 1000);
            }

            console.log(hashOfLocalStorageMasks, hashOfRemoteServerMasks);
            
            if ( hashOfLocalStorageMasks !== hashOfRemoteServerMasks) {
              // TODO: Write update function that takes masks as argument
              console.log("Update mask list for masks from server")
              // console.log(masksFromApi);
            }

            // If user has no masks created, focus on random gen button
            if (masks.length === 0) {
              const generateRandomMask = document.querySelector(".js-generate-random-mask");
              generateRandomMask.focus();
              return;
            }

            // If premium, focus on search instead
            if (premium) {
              popup.panel.masks.search.init();
            }

          },
          getRemainingAliases: async () => {
            const masks = await popup.utilities.getMasks({source: "getRemainingAliases"});
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
          // Check if user is premium (and then check if they have a domain set)
          // This is needed in order to query both random and custom masks
          const { premium } = await browser.storage.local.get("premium");
          let getMasksOptions = { fetchCustomMasks: false, source: "stats.init" };

          if (premium) {
            // Check if user may have custom domain masks
            const { premiumSubdomainSet } = await browser.storage.local.get(
              "premiumSubdomainSet"
            );

            // API Note: If a user has not registered a subdomain yet, its default stored/queried value is "None";
            const isPremiumSubdomainSet = premiumSubdomainSet !== "None";
            getMasksOptions.fetchCustomMasks = isPremiumSubdomainSet;
          }

          const masks = await popup.utilities.getMasks(getMasksOptions);

           // Get Global Mask Stats data
          const totalAliasesUsedVal = masks.length;
          let totalEmailsForwardedVal = 0;
          let totalEmailsBlockedVal = 0;
          
          // Loop through all masks to calculate totals
          masks.forEach((mask) => {
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
          if ( popup.utilities.checkIfAnyMasksWereGeneratedOnCurrentWebsite(masks,currentPageHostName) ) {
            
            // Some masks are used on the current site. Time to calculate!
            const filteredMasks = masks.filter(
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
      checkIfAnyMasksWereGeneratedOnCurrentWebsite: (masks, domain) => {
        return masks.some((mask) => {
          return domain === mask.generated_for;
        });
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
          await browser.runtime.sendMessage({
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
      getMasks: async (options = { fetchCustomMasks: false, updateLocalMasks: false, source: "test" }) => {
        const serverStoragePref =
          await popup.utilities.getCachedServerStoragePref();

        if (serverStoragePref) {
          try {
            const masksFromServer = await browser.runtime.sendMessage({
              method: "getAliasesFromServer",
              options,
            });

            const hash = await popup.utilities.getSHA256Hash(JSON.stringify(masksFromServer));
            
            await browser.storage.local.set({
              hashOfRemoteServerMasks: hash,
            });

            if (options.updateLocalMasks) {
              
              // Save this query to local storage
              await browser.storage.local.set({
                relayAddresses: masksFromServer,
              });

              // If we're saving masks, save a new hash too
              await browser.storage.local.set({
                hashOfLocalStorageMasks: hash,
              });
            }
            
            
            
            return masksFromServer;
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
      getSHA256Hash: async (input) => {
        const textAsBuffer = new TextEncoder().encode(input);
        const hashBuffer = await window.crypto.subtle.digest("SHA-256", textAsBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hash = hashArray
          .map((item) => item.toString(16).padStart(2, "0"))
          .join("");
        return hash;
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
          const getBundlePrice = getBundlePlans.plan_country_lang_mapping[getBundlePlans.country_code].en.yearly.price;
          const getBundleCurrency = getBundlePlans.plan_country_lang_mapping[getBundlePlans.country_code].en.yearly.currency
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
    },
  };

  popup.init();
})();
