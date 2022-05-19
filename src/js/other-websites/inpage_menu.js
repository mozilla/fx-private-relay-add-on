// Let usage. We need a global object of masks to between all inpage_menu functions
let masks = {};

async function iframeCloseRelayInPageMenu() {
  document.removeEventListener("keydown", handleKeydownEvents);
  await browser.runtime.sendMessage({ method: "iframeCloseRelayInPageMenu" });
}

function getRelayMenuEl() {
  return document.querySelector(".fx-relay-menu-body");
}

let activeElemIndex = 0;
async function handleKeydownEvents(e) {
  const relayInPageMenu = getRelayMenuEl();
  const clickableElsInMenu =
    relayInPageMenu.querySelectorAll("button, a, input");
  const watchedKeys = ["Escape", "ArrowDown", "ArrowUp"];
  const watchedKeyClicked = watchedKeys.includes(e.key);

  if (e.key === "ArrowDown") {
    preventDefaultBehavior(e);
    activeElemIndex += 1;
  }

  if (e.key === "ArrowUp") {
    preventDefaultBehavior(e);
    activeElemIndex -= 1;
  }

  if (e.key === "Escape") {
    preventDefaultBehavior(e);
    await iframeCloseRelayInPageMenu();
  }

  if (clickableElsInMenu[activeElemIndex] !== undefined && watchedKeyClicked) {
    return clickableElsInMenu[activeElemIndex].focus();
  }

  // Limit the lower bounds of the active element tab index (Don't go below 0)
  if (activeElemIndex <= 0) {
    activeElemIndex = 0;
  }

  // Limit the upper bounds of the active element tab index (Don't go below however many tab-able elements there are)
  if (activeElemIndex >= clickableElsInMenu.length) {
    activeElemIndex = clickableElsInMenu.length - 1;
  }
}

async function isUserSignedIn() {
  const userApiToken = await browser.storage.local.get("apiToken");
  return Object.prototype.hasOwnProperty.call(userApiToken, "apiToken");
}

async function getCachedServerStoragePref() {
  const serverStoragePref = await browser.storage.local.get("server_storage");
  const serverStoragePrefInLocalStorage = Object.prototype.hasOwnProperty.call(
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
}

async function getMasks(options = { fetchCustomMasks: false }) {
  const serverStoragePref = await getCachedServerStoragePref();

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
}

function addUsedOnDomain(domainList, currentDomain) {
  // Domain already exists in used_on field. Just return the list!
  if (domainList.includes(currentDomain)) {
    return domainList;
  }

  // Domain DOES NOT exist in used_on field. Add it to the domainList and put it back as a CSV string.
  // If there's already an entry, add a comma too
  domainList += (domainList  !== "") ? `,${currentDomain}` : currentDomain;
  return domainList;
}

async function fillTargetWithRelayAddress(generateClickEvt) {
  sendInPageEvent("click", "input-menu-reuse-alias");
  preventDefaultBehavior(generateClickEvt);

  generateClickEvt.target.classList.add("is-loading");

  const maskAddress = generateClickEvt.target.dataset.mask;
  const maskAddressId = generateClickEvt.target.dataset.maskId;

  const maskObject = masks.find(
    (mask) => mask.id === parseInt(maskAddressId, 10)
  );

  const currentUsedOnValue = maskObject.used_on;

  const currentPageHostName = await browser.runtime.sendMessage({
    method: "getCurrentPageHostname",
  });

  // If the used_on field is blank, then just set it to the current page/hostname. Otherwise, add/check if domain exists in the field
  const used_on = (currentUsedOnValue === null || currentUsedOnValue === undefined || currentUsedOnValue === "") ? `${currentPageHostName},` : addUsedOnDomain(currentUsedOnValue, currentPageHostName)
  
  // Update server info with site usage
  await browser.runtime.sendMessage({
    method: "patchMaskInfo",
    id: parseInt(maskAddressId, 10),
    data: {
      used_on
    },
    options: {
      auth: true,
    },
  });

  // TODO: Add telemetry event (?)

  await browser.runtime.sendMessage({
    method: "fillInputWithAlias",
    message: {
      filter: "fillInputWithAlias",
      newRelayAddressResponse: {
        address: maskAddress,
        currentDomain: currentPageHostName,
      },
    },
  });
}

async function populateFreeMaskList(maskList, masks) {
  const list = maskList.querySelector("ul");

  if (masks.length === 0) {
    return;
  }

  const fragment = document.createDocumentFragment();

  masks.forEach((mask) => {
    const listItem = document.createElement("li");
    const listButton = document.createElement("button");

    listButton.tabIndex = 0;

    listButton.dataset.domain = mask.domain;
    listButton.dataset.maskId = mask.id;
    listButton.dataset.mask = mask.full_address;
    listButton.dataset.label = mask.description;

    // The button text for a mask will be either the description label or the full address.
    listButton.textContent = mask.description || mask.full_address;

    listButton.addEventListener("click", fillTargetWithRelayAddress, false);

    listItem.appendChild(listButton);
    fragment.appendChild(listItem);
  });

  list.appendChild(fragment);

  // Remove loading state
  const loadingItem = maskList.querySelector(
    ".fx-relay-menu-masks-list-loading"
  );
  loadingItem.remove();
  list.classList.remove("is-loading");

  maskList.classList.add("is-visible");

  // The free UI has both lists wrapped up in a hidden-by-default element, so this makes it visible too.
  document.querySelector(".fx-relay-menu-masks-lists")?.classList.add("is-visible");

  await browser.runtime.sendMessage({
    method: "updateIframeHeight",
    height: document.getElementById("fxRelayMenuBody").scrollHeight,
  });
}

async function populatePremiumMaskList(maskList, masks) {
  const list = maskList.querySelector("ul");

  if (masks.length === 0) {
    return;
  }

  masks.forEach((mask) => {
    const listItem = document.createElement("li");
    const listButton = document.createElement("button");

    listButton.tabIndex = 0;
    listButton.dataset.domain = mask.domain;
    listButton.dataset.maskId = mask.id;
    listButton.dataset.mask = mask.full_address;
    listButton.dataset.label = mask.description;

    // The button text for a mask will show both the description label (if set) and the full address.
    const listButtonLabel = document.createElement("span");
    listButtonLabel.classList.add("fx-relay-menu-masks-search-result-label");
    const listButtonAddress = document.createElement("span");
    listButtonAddress.classList.add("fx-relay-menu-masks-search-result-address");
    listButtonLabel.textContent = mask.description;
    listButtonAddress.textContent = mask.full_address;
    listButton.appendChild(listButtonLabel);
    listButton.appendChild(listButtonAddress);

    listButton.addEventListener("click", fillTargetWithRelayAddress, false);

    listItem.appendChild(listButton);
    list.appendChild(listItem);
  });

  // Remove loading state
  const loadingItem = maskList.querySelector(
    ".fx-relay-menu-masks-list-loading"
  );
  loadingItem.remove();
  list.classList.remove("is-loading");

  // The free UI has both lists wrapped up in a hidden-by-default element, so this makes it visible too.
  document.querySelector(".fx-relay-menu-masks-lists")?.classList.add("is-visible");

  await browser.runtime.sendMessage({
    method: "updateIframeHeight",
    height: document.getElementById("fxRelayMenuBody").scrollHeight,
  });
}

const sendInPageEvent = (evtAction, evtLabel) => {
  sendRelayEvent("In-page", evtAction, evtLabel);
};

function applySearchFilter(query) {
  // The search results will only count/return from whichever list is active/visible.
  const maskSearchResults = Array.from(
    document.querySelectorAll(".fx-relay-menu-masks-list.is-visible ul li")
  );

  maskSearchResults.forEach((maskResult) => {
    const button = maskResult.querySelector("button");
    const emailAddress = button.dataset.mask;
    const label = button.dataset.label;
    const matchesSearchFilter =
      label.toLowerCase().includes(query.toLowerCase()) ||
      emailAddress.toLowerCase().includes(query.toLowerCase());

    if (matchesSearchFilter) {
      maskResult.classList.remove("is-hidden");
    } else {
      maskResult.classList.add("is-hidden");
    }
  });

  // Set #/# labels inside search bar to show results count
  const searchFilterTotal = document.querySelector(".js-filter-masks-total");
  const searchFilterVisible = document.querySelector(
    ".js-filter-masks-visible"
  );

  searchFilterVisible.textContent = maskSearchResults.filter((maskResult) => !maskResult.classList.contains("is-hidden")).length;
  searchFilterTotal.textContent = maskSearchResults.length;
}

function checkIfAnyMasksWereGeneratedOnCurrentWebsite(masks, domain) {
  return masks.some((mask) => {
    return domain === mask.generated_for;
  });
}

function hasMaskBeenUsedOnCurrentSite(mask, domain) {
  const domainList = mask.used_on;

  // Short circuit out if there's no used_on entry
  if (domainList === null || domainList === "" ||  domainList === undefined) { return false; }

  // Domain already exists in used_on field. Just return the list!
  if (domainList.includes(domain)) {
    return true;
  }

  // No match found! 
  return false;
}

function haveMasksBeenUsedOnCurrentSite(masks, domain) {
  return masks.some(mask => {
    
    const domainList = mask.used_on;

    // Short circuit out if there's no used_on entry
    if (domainList === null || domainList === "" ||  domainList === undefined) { return false; }

    // Domain already exists in used_on field. Just return the list!
    if (domainList.includes(domain)) {
      return true;
    }
    // No match found! 
    return false;
  })
}

const buildContent = {
  loggedIn: {
    free: async (relaySiteOrigin) => {
      const fxRelayMenuBody = document.getElementById("fxRelayMenuBody");

      const signedInContentFree = document.querySelector(
        ".fx-content-signed-in-free"
      );

      const signedInContentPremium = document.querySelector(
        ".fx-content-signed-in-premium"
      );

      signedInContentPremium?.remove();

      // Create "You have .../.. remaining relay address" message
      const remainingAliasesSpan = document.querySelector(
        ".fx-relay-menu-remaining-aliases"
      );

      const { maxNumAliases } = await browser.storage.local.get(
        "maxNumAliases"
      );

      const maskLists = document.querySelectorAll(".fx-relay-menu-masks-list");
      masks = await getMasks();

      const currentPageHostName = await browser.runtime.sendMessage({
        method: "getCurrentPageHostname",
      });

      maskLists?.forEach(async (maskList) => {
        // Set Mask List label names
        const label = maskList.querySelector(".fx-relay-menu-masks-list-label");
        const stringId = label.dataset.stringId;

        label.textContent = browser.i18n.getMessage(stringId);

        // If there are no masks used on the current site, we need to change the label for the other masks:
        if (
          !checkIfAnyMasksWereGeneratedOnCurrentWebsite(masks, currentPageHostName) &&
          maskList.classList.contains("fx-relay-menu-masks-free-other")
        ) {
          label.textContent = browser.i18n.getMessage("pageInputIconSelectFromYourCurrentEmailMasks");
        }

        if (masks.length > 0) {
          // Populate mask lists, but filter by current website
          const buildFilteredMaskList = maskList.classList.contains(
            "fx-relay-menu-masks-free-this-website"
          );

          const filteredMasks = buildFilteredMaskList
            ? masks.filter(
                (mask) => mask.generated_for === currentPageHostName || hasMaskBeenUsedOnCurrentSite(mask, currentPageHostName)
              )
            : masks.filter(
              (mask) => mask.generated_for !== currentPageHostName && !hasMaskBeenUsedOnCurrentSite(mask, currentPageHostName)
              );

          await populateFreeMaskList(maskList, filteredMasks);
        }
      });

      const numAliasesRemaining = maxNumAliases - masks.length;
      const maxNumAliasesReached = numAliasesRemaining <= 0;

      // Set Generate Mask button
      buildContent.components.setUnlimitedButton(relaySiteOrigin);

      // Free user: Set text informing them how many aliases they can create
      remainingAliasesSpan.textContent = browser.i18n.getMessage(
        "popupRemainingFreeMasks",
        [numAliasesRemaining, maxNumAliases]
      );

      const generateAliasBtn = document.querySelector(
        ".fx-relay-menu-generate-alias-btn"
      );

      if (maxNumAliasesReached) {
        generateAliasBtn.remove();
        sendInPageEvent("viewed-menu", "input-menu-max-aliases-message");
        remainingAliasesSpan.textContent = browser.i18n.getMessage(
          "pageNoMasksRemaining"
        );

        // Check if premium features are available
        const premiumCountryAvailability = (
          await browser.storage.local.get("premiumCountries")
        )?.premiumCountries;

        const getUnlimitedAliasesBtn = document.querySelector(
          ".fx-relay-menu-get-unlimited-aliases"
        );

        // If the user cannot upgrade, prompt them to join the waitlist
        if ( premiumCountryAvailability?.premium_available_in_country !== true ) {
          getUnlimitedAliasesBtn.textContent = browser.i18n.getMessage("pageInputIconJoinPremiumWaitlist");
          // TODO: (?) Change URL to waitlist page, adjust telemetry to measure 
        }

        getUnlimitedAliasesBtn.classList.remove("t-secondary");
        getUnlimitedAliasesBtn.classList.add("t-primary");
        // Focus on "Get unlimited alias" button
        getUnlimitedAliasesBtn.focus();

        // In the UX, there are three+ elements (from top to bottom): "Generate more" button, the list(s) and the upgrade button. When the user has maxed out their available masks, the "Generate more" button is hidden/replaced with the upgrade button. The order change is necessary to match the UX.
        document.querySelector(".fx-relay-menu-masks-lists").style.order = "2";
      } else {
        // Set Generate Mask button
        await buildContent.components.generateMaskButton();

        // Focus on "Generate New Alias" button
        generateAliasBtn.focus();
      }

      fxRelayMenuBody.classList.remove("is-loading");
      // User is signed in/free: Remove the premium section from DOM so there are no hidden/screen readable-elements available
      fxRelayMenuBody.classList.remove("is-premium");
      signedInContentFree?.classList.remove("is-hidden");

      await browser.runtime.sendMessage({
        method: "updateIframeHeight",
        height: fxRelayMenuBody.scrollHeight,
      });
    },
    premium: async () => {
      const fxRelayMenuBody = document.getElementById("fxRelayMenuBody");

      const signedInContentFree = document.querySelector(
        ".fx-content-signed-in-free"
      );

      const signedInContentPremium = document.querySelector(
        ".fx-content-signed-in-premium"
      );

      // User is signed in/premium: Remove the free section from DOM so there are no hidden/screen readable-elements available
      signedInContentPremium?.classList.remove("is-hidden");
      signedInContentFree?.remove();

      // Resize iframe
      await browser.runtime.sendMessage({
        method: "updateIframeHeight",
        height: fxRelayMenuBody.scrollHeight,
      });

      // Check if user may have custom domain masks
      const { premiumSubdomainSet } = await browser.storage.local.get(
        "premiumSubdomainSet"
      );

      // API Note: If a user has not registered a subdomain yet, its default stored/queried value is "None";
      const isPremiumSubdomainSet = premiumSubdomainSet !== "None";

      // Get masks, including subdomain/custom masks if available
      masks = await getMasks({
        fetchCustomMasks: isPremiumSubdomainSet,
      });

      // Request the active tab from the background script and parse the `document.location.hostname`
      const currentPageHostName = await browser.runtime.sendMessage({
        method: "getCurrentPageHostname",
      });

      // See if any masks are assosiated with the current site. 
      // If so, we'll end up building two discrete mask lists:  
      // 1. Just masks for that specific website
      // 2. All masks (including ones from the previous list)
      const userHasMasksForCurrentWebsite = (checkIfAnyMasksWereGeneratedOnCurrentWebsite(masks, currentPageHostName)) || haveMasksBeenUsedOnCurrentSite(masks, currentPageHostName);

      // If there are no masks assosiated with the current site, remove that list entirely.
      if (!userHasMasksForCurrentWebsite) {
        document.querySelector(".fx-relay-menu-masks-list-this-website").remove();
      }

      const maskLists = document.querySelectorAll(".fx-relay-menu-masks-list");

      // Now we can set the toggle buttons between the two lists.
      if (userHasMasksForCurrentWebsite) {
        fxRelayMenuBody.classList.add(".fx-relay-mask-list-toggle-height");

        const filterMenu = document.querySelector(
          ".fx-relay-menu-filter-active-site"
        );
        filterMenu.classList.add("is-visible");

        const filterMenuButtons = filterMenu.querySelectorAll("button");

        filterMenuButtons.forEach((button) => {
          const stringId = button.dataset.stringId;
          button.textContent = browser.i18n.getMessage(stringId);

          // TODO: Move this function elsewhere

          button.addEventListener("click", async (event) => {
            await buildContent.components.setMaskListButton(event.target, maskLists, filterMenuButtons);
          });
        });
      }

      maskLists?.forEach(async (maskList) => {

        // Check if the list we're currently building is "From this website". This logic will be used throughout the function
        const buildFilteredMaskList = maskList.classList.contains(
          "fx-relay-menu-masks-list-this-website"
        );

        const filteredMasks = buildFilteredMaskList
          ? masks.filter((mask) => mask.generated_for === currentPageHostName || hasMaskBeenUsedOnCurrentSite(mask, currentPageHostName))
          : masks;

        // Process the masks list based on how many masks there are: 
        // If there is none, we'll only show the "Generate new mask" button
        // If there's less than five, we'll show all of them
        // If there's MORE than five, we'll show all of them and show the search/filter bar
        if (filteredMasks.length === 0) {
          if (buildFilteredMaskList) {
            // We only want to remove the the search field if there's NO masks.
            return;
          }

          buildContent.components.search.remove();
        } else {
          // Built out each list
          await populatePremiumMaskList(maskList, filteredMasks);
        }
      });

      // Set the first available list to visible.
      // If there's "From this website" masks, it will show that list first. 
      document.querySelector(".fx-relay-menu-masks-list")?.classList.add("is-visible");

      // Set Generate Mask button
      await buildContent.components.generateMaskButton();

      fxRelayMenuBody.classList.remove("is-loading");

      // Check if search has been removed. If not, init it!  
      const search = document.querySelector(".fx-relay-menu-masks-search");
      if (search) {
        await buildContent.components.search.init();
        const filterSearchForm = document.querySelector(
          ".fx-relay-menu-masks-search-form"
        );

        // If the visible list has enough masks to show the search bar, focus on it
        // Note that the buildContent.components.search function also runs the updateIframeHeight event.
        if (filterSearchForm.classList.contains("is-visible")) {
          await buildContent.components.search.initResultsCountAndFocusOnInput();
          return;
        }
      }

      const generateAliasBtn = document.querySelector(
        ".fx-relay-menu-generate-alias-btn"
      );

      await browser.runtime.sendMessage({
        method: "updateIframeHeight",
        height: fxRelayMenuBody.scrollHeight,
      });

      // Focus on "Generate New Alias" button
      generateAliasBtn.focus();

      return;
    },
  },
  loggedOut: () => {
    // Remove signed in content from DOM so there are no hidden/screen readable-elements available
    document.getElementById("fxRelayMenuBody").classList.remove("is-premium");
    const signedOutContent = document.querySelector(".fx-content-signed-out");
    const signedInContentFree = document.querySelector(
      ".fx-content-signed-in-free"
    );
    const signedInContentPremium = document.querySelector(
      ".fx-content-signed-in-premium"
    );

    signedOutContent?.classList.remove("is-hidden");

    signedInContentFree?.remove();
    signedInContentPremium?.remove();

    const signUpMessageEl = document.querySelector(
      ".fx-relay-menu-sign-up-message"
    );

    signUpMessageEl.textContent = browser.i18n.getMessage(
      "pageInputIconSignUpText"
    );

    const signUpButton = document.querySelector(".fx-relay-menu-sign-up-btn");

    signUpButton.textContent = browser.i18n.getMessage(
      "pageInputIconSignUpButton"
    );

    signUpButton.addEventListener("click", async (clickEvt) => {
      preventDefaultBehavior(clickEvt);
      await browser.runtime.sendMessage({
        method: "openRelayHomepage",
      });
      sendInPageEvent("click", "input-menu-sign-up-btn");
      await iframeCloseRelayInPageMenu();
    });

    sendInPageEvent("viewed-menu", "unauthenticated-user-input-menu");

    // Focus on "Go to Firefox Relay" button
    signUpButton.focus();

    document.getElementById("fxRelayMenuBody").classList.remove("is-loading");

    // Bug: There's a race condition on how fast to detect the iframe being loaded. The setTimeout solves it for now.
    setTimeout(async () => {
      await browser.runtime.sendMessage({
        method: "updateIframeHeight",
        height: document.getElementById("fxRelayMenuBody").scrollHeight,
      });
    }, 10);
  },
  components: {
    setMaskListButton: async (button, maskLists, filterMenuButtons) => {
        // Hide all lists, show selected list
        maskLists.forEach((maskList) => {
          maskList.classList.remove("is-visible");
        });

        const maskListSelector = button.dataset.maskList;
        const activeMaskList = document.querySelector(maskListSelector);
        const activeMaskListCount = activeMaskList.querySelectorAll("li");

        activeMaskList.classList.add("is-visible");

        const filterSearchForm = document.querySelector(
          ".fx-relay-menu-masks-search-form"
        );
        
        // If there's enough masks in this list, we need to show search.
        if (activeMaskListCount.length > 5) {
          filterSearchForm.classList.add("is-visible");
          await buildContent.components.search.initResultsCountAndFocusOnInput();
        } else {
          filterSearchForm.classList.remove("is-visible");
        }

        // Make all buttons inactive, make selected button active
        filterMenuButtons.forEach((maskList) => {
          maskList.classList.remove("is-active");
        });

        button.classList.add("is-active");

        // Resize iframe
        await browser.runtime.sendMessage({
          method: "updateIframeHeight",
          height: document.getElementById("fxRelayMenuBody").scrollHeight,
        });      
    },
    generateMaskButton: async () => {
      // Create "Generate Relay Address" button
      const generateAliasBtn = document.querySelector(
        ".fx-relay-menu-generate-alias-btn"
      );

      generateAliasBtn.textContent = browser.i18n.getMessage(
        "pageInputIconGenerateNewAlias_mask"
      );

      // Handle "Generate New Alias" clicks
      generateAliasBtn.addEventListener("click", async (generateClickEvt) => {
        sendInPageEvent("click", "input-menu-reuse-previous-alias");
        preventDefaultBehavior(generateClickEvt);

        generateAliasBtn.classList.add("is-loading");

        // Request the active tab from the background script and parse the `document.location.hostname`
        const currentPageHostName = await browser.runtime.sendMessage({
          method: "getCurrentPageHostname",
        });

        // Attempt to create a new alias
        const newRelayAddressResponse = await browser.runtime.sendMessage({
          method: "makeRelayAddress",
          description: currentPageHostName,
        });

        // Catch edge cases where the "Generate New Alias" button is still enabled,
        // but the user has already reached the max number of aliases.
        if (newRelayAddressResponse.status === 402) {
          generateClickEvt.target.classList.remove("is-loading");
          throw new Error(
            browser.i18n.getMessage("pageInputIconMaxAliasesError_mask")
          );
        }

        await browser.runtime.sendMessage({
          method: "fillInputWithAlias",
          message: {
            filter: "fillInputWithAlias",
            newRelayAddressResponse,
          },
        });
      });
    },
    setUnlimitedButton: (relaySiteOrigin) => {
      // Create "Get unlimited aliases" button
      const getUnlimitedAliasesBtn = document.querySelector(
        ".fx-relay-menu-get-unlimited-aliases"
      );

      getUnlimitedAliasesBtn.textContent = browser.i18n.getMessage(
        "popupGetUnlimitedAliases_mask"
      );

      // Create "Get unlimited aliases" link
      getUnlimitedAliasesBtn.href = `${relaySiteOrigin}/premium?utm_source=fx-relay-addon&utm_medium=input-menu&utm_content=get-premium-link`;
      getUnlimitedAliasesBtn.target = "_blank";
      getUnlimitedAliasesBtn.addEventListener("click", async () => {
        sendInPageEvent("click", "input-menu-get-premium-btn");
        await iframeCloseRelayInPageMenu();
      });
    },
    setManageLink: (relaySiteOrigin) => {
      // Create "Manage All Aliases" link
      const relayMenuDashboardLink = document.querySelector(
        ".fx-relay-menu-dashboard-link"
      );

      const relayMenuDashboardLinkTooltip =
        relayMenuDashboardLink.querySelector(
          ".fx-relay-menu-dashboard-link-tooltip"
        );

      relayMenuDashboardLinkTooltip.textContent =
        browser.i18n.getMessage("labelManage");

      relayMenuDashboardLink.href = `${relaySiteOrigin}?utm_source=fx-relay-addon&utm_medium=input-menu&utm_content=manage-all-addresses`;
      relayMenuDashboardLink.target = "_blank";

      relayMenuDashboardLink.addEventListener("click", async () => {
        sendInPageEvent("click", "input-menu-manage-all-aliases-btn");
        await iframeCloseRelayInPageMenu();
      });
    },
    search: {
      initResultsCountAndFocusOnInput: async () => {
        // If there's a search bar visible, focus on that instead of the generate
        const filterSearchInput = document.querySelector(
          ".fx-relay-menu-masks-search-input"
        );

        const searchFilterTotal = document.querySelector(
          ".js-filter-masks-total"
        );

        const searchFilterVisible = document.querySelector(
          ".js-filter-masks-visible"
        );

        const maskSearchResults = document.querySelectorAll(
          ".fx-relay-menu-masks-list.is-visible ul li"
        );

        searchFilterTotal.textContent = maskSearchResults.length;
        searchFilterVisible.textContent = maskSearchResults.length;

        // Resize iframe
        await browser.runtime.sendMessage({
          method: "updateIframeHeight",
          height: document.getElementById("fxRelayMenuBody").scrollHeight,
        });

        filterSearchInput.focus();
      },
      init: async () => {
        const filterSearchForm = document.querySelector(
          ".fx-relay-menu-masks-search-form"
        );

        const filterSearchInput = filterSearchForm.querySelector(
          ".fx-relay-menu-masks-search-input"
        );

        filterSearchInput.placeholder = browser.i18n.getMessage("labelSearch");

        filterSearchForm.addEventListener("submit", (event) => {
          event.preventDefault();
          filterSearchInput.blur();
        });

        filterSearchInput.addEventListener("input", (event) => {
          applySearchFilter(event.target.value);
        });

        const maskLists = document.querySelectorAll(
          ".fx-relay-menu-masks-list"
        );

        maskLists.forEach((maskList) => {
          const maskNumber = maskList.querySelectorAll("li").length;
          if (maskNumber > 5) {
            if (maskList.classList.contains("is-visible")) {
              buildContent.components.search.show();
              return;
            }

            return;
          }

          maskList.classList.add("t-no-search-bar");
        });

        // Resize iframe
        await browser.runtime.sendMessage({
          method: "updateIframeHeight",
          height: document.getElementById("fxRelayMenuBody").scrollHeight,
        });
      },
      remove: () => {
        const search = document.querySelector(".fx-relay-menu-masks-search");
        search.remove();
      },
      show: () => {
        const filterSearchForm = document.querySelector(
          ".fx-relay-menu-masks-search-form"
        );
        filterSearchForm.classList.add("is-visible");

        const maskListUl = document.querySelector(
          ".fx-relay-menu-masks-list.is-visible ul"
        );
        maskListUl.style.height = `${maskListUl.offsetHeight}px`;
      },
    },
  },
};

async function inpageContentInit() {
  const { relaySiteOrigin } = await browser.storage.local.get(
    "relaySiteOrigin"
  );

  // Set custom fonts from the add-on
  await setCustomFonts();

  const signedInUser = await isUserSignedIn();
  const signedOutContent = document.querySelector(".fx-content-signed-out");

  // Set Listeners
  document.addEventListener("keydown", handleKeydownEvents);

  // Set Manage All Masks Link
  buildContent.components.setManageLink(relaySiteOrigin);

  // Build Content: Logged out user
  if (!signedInUser) {
    buildContent.loggedOut();
    return;
  }

  // Remove signed out content from DOM so there are no hidden/screen readable-elements available
  signedOutContent.remove();

  sendInPageEvent("viewed-menu", "authenticated-user-input-menu");

  // If the user has a premium accout, they may create unlimited aliases.
  const { premium } = await browser.storage.local.get("premium");

  if (premium) {
    await buildContent.loggedIn.premium();
    return;
  }

  // User is free
  await buildContent.loggedIn.free(relaySiteOrigin);
}

document.addEventListener("DOMContentLoaded", async () => {
  await inpageContentInit();
});
