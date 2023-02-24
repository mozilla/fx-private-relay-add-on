/* global getBrowser checkWaffleFlag psl */

(async () => {
  // Global Data
  const { relaySiteOrigin } = await browser.storage.local.get(
    "relaySiteOrigin"
  );

  const state = {
    currentPanel: null,
    newsItemsCount: 0,
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
        if (!state.loggedIn && backNavLevel === "root") {
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

      state.loggedIn = await popup.utilities.isUserSignedIn();

      // Check if user is signed in to show default/sign-in panel
      if (state.loggedIn) {
        popup.panel.update("masks");
        popup.utilities.unhideNavigationItemsOnceLoggedIn();
        popup.utilities.populateNewsFeed();
      } else {
        popup.panel.update("sign-up");
        document.body.classList.remove("is-loading");
      }

      // Set External Event Listerners
      await popup.utilities.setExternalLinkEventListeners();

      // Set Notification Bug for Unread News Items
      popup.panel.news.utilities.initNewsItemCountNotification();

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

        state.currentPanel = panelId;
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
            const { premiumSubdomainSet } = await browser.storage.local.get("premiumSubdomainSet");            
            customMaskDomainInput.placeholder = browser.i18n.getMessage("popupCreateCustomFormMaskInputPlaceholder");
            customMaskDomainLabel.textContent = browser.i18n.getMessage("popupCreateCustomFormMaskInputDescription", premiumSubdomainSet);

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
          
          const masks = await popup.utilities.getMasks();
          const generateRandomMask = document.querySelector(".js-generate-random-mask");
          const { premium } = await browser.storage.local.get("premium");
          const maskPanel = document.getElementById("masks-panel");
          
          if (!premium) {
            await popup.panel.masks.utilities.setRemainingMaskCount();
            maskPanel.setAttribute("data-account-level", "free");
          } else {            
            maskPanel.setAttribute("data-account-level", "premium");

            // Update language of Generate Random Mask to "Generate random mask"
            generateRandomMask.textContent = browser.i18n.getMessage("pageInputIconGenerateRandomMask");

            // Prompt user to register subdomain
            const { premiumSubdomainSet } = await browser.storage.local.get("premiumSubdomainSet");            
            const isPremiumSubdomainSet = premiumSubdomainSet !== "None";  
          
            if (!isPremiumSubdomainSet) {
              const registerSubdomainButton = document.querySelector(".fx-relay-regsiter-subdomain-button");
              registerSubdomainButton.classList.remove("is-hidden");
            } else {
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
          

          // If no masks are created, show onboarding prompt
          if (masks.length === 0) {
            const noMasksCreatedPanel = document.querySelector(".fx-relay-no-masks-created");
            noMasksCreatedPanel.classList.remove("is-hidden");
          }

          // Build initial list
          // Note: If premium, buildMasksList runs `popup.panel.masks.search.init()` after completing
          popup.panel.masks.utilities.buildMasksList();
        

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
            
            if (numRemaining === 0) {
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
            state.newsContent.forEach(async (newsItem) => {
              // Check for any catches to not display the item
              const hasLogicCheck = Object.prototype.hasOwnProperty.call(newsItem, "logicCheck");
              
              if (
                // Check for waffle (Waffle must return false to catch)
                (
                  newsItem.waffle &&
                  !(await checkWaffleFlag(newsItem.waffle)))
                ||
                // logicCheck Function (Must return false to catch)
                (hasLogicCheck && !newsItem.logicCheck)
              ) {
                return;
              }

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
            if (!state.loggedIn) {
              return;
            }

            const storyData = state.newsContent.filter((story) => { return story.id == newsItemId });
            const newsItemContent = storyData[0];
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
                unreadNewsItemsCount: state.newsItemsCount,
                readNewsItemCount: 0,
              });
            }

            // FIXME: The total news item count may differ than what is displayed to the user
            // Example: Three items total but user doesn't have waffle for one news item. 
            // Regardless - update the unreadNews count to match whatever is in state
            await browser.storage.local.set({
              unreadNewsItemsCount: state.newsItemsCount,
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
                readNewsItemCount: state.newsItemsCount,
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
            
          if (state.loggedIn) {
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
          // Get Global Mask Stats data
          const { aliasesUsedVal } = await browser.storage.local.get(
            "aliasesUsedVal"
          );
          const { emailsForwardedVal } = await browser.storage.local.get(
            "emailsForwardedVal"
          );
          const { emailsBlockedVal } = await browser.storage.local.get(
            "emailsBlockedVal"
          );

          const globalStatSet = document.querySelector(
            ".dashboard-stats-list.global-stats"
          );

          const globalAliasesUsedValEl =
            globalStatSet.querySelector(".aliases-used");
          const globalEmailsBlockedValEl =
            globalStatSet.querySelector(".emails-blocked");
          const globalEmailsForwardedValEl =
            globalStatSet.querySelector(".emails-forwarded");

          globalAliasesUsedValEl.textContent = aliasesUsedVal;
          globalEmailsBlockedValEl.textContent = emailsBlockedVal;
          globalEmailsForwardedValEl.textContent = emailsForwardedVal;

          // Check if any data applies to the current site
          const currentPageHostName = await browser.runtime.sendMessage({
            method: "getCurrentPageHostname",
          });

          // Check if user is premium (and then check if they have a domain set)
          // This is needed in order to query both random and custom masks
          const { premium } = await browser.storage.local.get("premium");
          let getMasksOptions = { fetchCustomMasks: false };

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

          const currentWebsiteStateSet = document.querySelector(
            ".dashboard-stats-list.current-website-stats"
          );

          if (
            popup.utilities.checkIfAnyMasksWereGeneratedOnCurrentWebsite(
              masks,
              currentPageHostName
            )
          ) {
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

            filteredMasks.forEach((mask) => {
              currentWebsiteForwardedVal += mask.num_forwarded;
              currentWebsiteBlockedVal += mask.num_blocked;
            });

            const currentWebsiteAliasesUsedValEl =
              currentWebsiteStateSet.querySelector(".aliases-used");
            currentWebsiteAliasesUsedValEl.textContent = filteredMasks.length;

            const currentWebsiteEmailsForwardedValEl =
              currentWebsiteStateSet.querySelector(".emails-forwarded");
            currentWebsiteEmailsForwardedValEl.textContent =
              currentWebsiteForwardedVal;

            const currentWebsiteEmailsBlockedValEl =
              currentWebsiteStateSet.querySelector(".emails-blocked");
            currentWebsiteEmailsBlockedValEl.textContent =
              currentWebsiteBlockedVal;

            const currentWebsiteEmailsBlocked =
              currentWebsiteStateSet.querySelector(
                ".dashboard-info-emails-blocked"
              );
            const currentWebsiteEmailsForwarded =
              currentWebsiteStateSet.querySelector(
                ".dashboard-info-emails-forwarded"
              );
            currentWebsiteEmailsBlocked.classList.remove("is-hidden");
            currentWebsiteEmailsForwarded.classList.remove("is-hidden");
          }
        },
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

          const reportContinueButton =
            document.querySelector(".report-continue");
          reportContinueButton.addEventListener(
            "click",
            popup.events.backClick,
            false
          );
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
          const otherCheckbox = document.querySelector(
            'input[name="issue-case-other"]'
          );
          const otherTextField = document.querySelector(
            'input[name="other_issue"]'
          );
          otherCheckbox.addEventListener("click", () => {
            otherTextField.classList.toggle("is-hidden");
          });

          // Add placeholder to report input on 'Other' selection
          const inputFieldOtherDetails = document.querySelector(
            'input[name="other_issue"]'
          );
          inputFieldOtherDetails.placeholder = browser.i18n.getMessage(
            "popupReportIssueCaseOtherDetails"
          );
        },
        showSuccessReportSubmission: () => {
          const reportIssueSubmitBtn = document.querySelector(
            ".report-issue-submit-btn"
          );
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

          await browser.runtime.sendMessage({
            method: "postReportWebcompatIssue",
            description: reportData,
          });
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
        if (
          domainList === null ||
          domainList === "" ||
          domainList === undefined
        ) {
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
        
        // FIXME: The order is not being set correctly
        if (isFirefoxIntegrationAvailable) {
          state.newsContent.push({
            id: "firefox-integration",
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
          state.newsContent.push({
            id: "phones",
            logicCheck: isPhoneMaskingAvailable,
            headlineString: "popupPhoneMaskingPromoHeadline",
            bodyString: "popupPhoneMaskingPromoBody",
            teaserImg:
              "/images/panel-images/announcements/premium-announcement-phone-masking.svg",
            fullImg:
              "/images/panel-images/announcements/premium-announcement-phone-masking-hero.svg",
            fullCta: "popupPhoneMaskingPromoCTA",
            fullCtaRelayURL: true,
            fullCtaHref:
              "/premium/#pricing?utm_source=fx-relay-addon&utm_medium=popup&utm_content=panel-news-phone-masking-cta",
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
          
          state.newsContent.push({
            id: "mozilla-vpn-bundle",
            logicCheck: isBundleAvailable,
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
              "/premium/#pricing?utm_source=fx-relay-addon&utm_medium=popup&utm_content=panel-news-bundle-cta",
            fullCtaEventLabel: "panel-news-bundle-cta",
            fullCtaEventAction: "click",
          },)
        }

        // Remove news nav link if there's no news items to display to user
        if (state.newsContent.length === 0 ) {
          document.querySelector(".fx-relay-menu-dashboard-link[data-panel-id='news']").remove();
          return;
        }

        // Update news item count
        state.newsItemsCount = state.newsContent.length;
      },
      setExternalLinkEventListeners: async () => {
        const externalLinks = document.querySelectorAll(".js-external-link");

        externalLinks.forEach((link) => {
          // Because we dynamically set the Relay origin URL (local/dev/stage/prod),
          // we have to catch Relay-specific links and prepend the correct Relay website URL
          if (link.dataset.relayInternal === "true") {
            // TODO: Remove "/" from here. It'll be error prone
            link.href = `${relaySiteOrigin}/${link.dataset.href}`;
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
