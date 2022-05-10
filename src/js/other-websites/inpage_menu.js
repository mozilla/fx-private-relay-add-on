async function iframeCloseRelayInPageMenu() {
  document.removeEventListener("keydown", handleKeydownEvents);
  await browser.runtime.sendMessage({ method: "iframeCloseRelayInPageMenu" });
}

function getRelayMenuEl() {
  return document.querySelector(".fx-relay-menu-body");
}

let activeElemIndex = 0;
async function handleKeydownEvents (e) {
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
  const serverStoragePrefInStorage =
    Object.prototype.hasOwnProperty.call(serverStoragePref, "server_storage");

  if (!serverStoragePrefInStorage) {
    return await browser.runtime.sendMessage({
      method: "getServerStoragePref",
    });
  } else {
    // The user has this pref set. Return the value
    return serverStoragePref.server_storage;
  }
}

async function getMasks(options = { fetchCustomMasks: false }) {
  const serverStoragePref = await getCachedServerStoragePref();

  if (serverStoragePref) {
    try {
      const masks = await browser.runtime.sendMessage({
        method: "getAliasesFromServer",
        options,
      });

      return masks;
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

async function fillTargetWithRelayAddress(generateClickEvt) {
  sendInPageEvent("click", "input-menu-reuse-alias");
  preventDefaultBehavior(generateClickEvt);

  const maskAddress = generateClickEvt.target.dataset.mask;

  await browser.runtime.sendMessage({
    method: "fillInputWithAlias",
    message: {
      filter: "fillInputWithAlias",
      newRelayAddressResponse: {
        address: maskAddress,
      },
    },
  });
}

async function populateMaskList(
  maskList,
  masks,
  options = { replaceMaskAddressWithLabel: false }
) {
  const list = maskList.querySelector("ul");

  if (masks.length === 0) {
    return;
  }

  masks.forEach((mask) => {
    const listItem = document.createElement("li");
    const listButton = document.createElement("button");

    listButton.tabIndex = 0;
    listButton.dataset.mask = mask.full_address;
    listButton.dataset.label = mask.description;

    if (options.replaceMaskAddressWithLabel) {
      // The button text for a mask will show both the description label (if set) and the full address.
      const listButtonLabel = document.createElement("span");
      listButtonLabel.classList.add("fx-relay-menu-masks-search-result-label");
      const listButtonAddress = document.createElement("span");
      listButtonAddress.classList.add(
        "fx-relay-menu-masks-search-result-address"
      );
      listButtonLabel.textContent = mask.description;
      listButtonAddress.textContent = mask.full_address;
      listButton.appendChild(listButtonLabel);
      listButton.appendChild(listButtonAddress);
    } else {
      // The button text for a mask will be either the description label or the full address.
      listButton.textContent = mask.description || mask.full_address;
    }

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

  maskList.classList.add("is-visible");
  
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
  const maskResults = Array.from(
    document.querySelectorAll(".fx-relay-menu-masks-search-results ul li")
  );

  maskResults.forEach((maskResult) => {
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

  // Add #/# labels to search filter
  const searchFilterTotal = document.querySelector(".js-filter-masks-total");
  const searchFilterVisible = document.querySelector(
    ".js-filter-masks-visible"
  );

  searchFilterVisible.textContent = maskResults.length;

  searchFilterVisible.textContent = maskResults.filter(
    (maskResult) => !maskResult.classList.contains("is-hidden")
  ).length;
  searchFilterTotal.textContent = maskResults.length;
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
      const masks = await getMasks();
      
      const currentPageHostName = await browser.runtime.sendMessage({
        method: "getCurrentPageHostname",
      });

      // function checkIfAnyMasksAreUsedOnCurrentWebsite(masks, domain) {
      //   return masks.some( mask => {
      //     return domain === mask.generated_for;
      //   });
      // }

      maskLists?.forEach(async (maskList) => {
        // Set Mask List label names

        const label = maskList.querySelector(".fx-relay-menu-masks-list-label");        

        const stringId = label.dataset.stringId;
        
        label.textContent = browser.i18n.getMessage(stringId);

        if (masks.length > 0) {
          // Populate mask lists, but filter by current website
          const buildFilteredMaskList = maskList.classList.contains("fx-relay-menu-masks-free-this-website");

          // TODO: Check additional field(s) besides "generated_for"
          const filteredMasks = buildFilteredMaskList ? 
            masks.filter(mask => mask.generated_for === currentPageHostName)
            : masks.filter(mask => mask.generated_for !== currentPageHostName);
          
          await populateMaskList(maskList, filteredMasks);
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

        const getUnlimitedAliasesBtn = document.querySelector(
          ".fx-relay-menu-get-unlimited-aliases"
        );

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

      // TODO: Add premiumCountryAvailability Check 
      // Check if premium features are available
      // const premiumCountryAvailability = (
      //   await browser.storage.local.get("premiumCountries")
      // )?.premiumCountries;

      // if (
      //   premiumCountryAvailability?.premium_available_in_country !== true ||
      //   !maxNumAliasesReached
      // ) {
      //   getUnlimitedAliasesBtn.remove();
      // }

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

      const searchInput = document.querySelector(
        ".fx-relay-menu-masks-search-input"
      );

      searchInput.placeholder = browser.i18n.getMessage("labelSearch");

      // Resize iframe
      await browser.runtime.sendMessage({
        method: "updateIframeHeight",
        height: fxRelayMenuBody.scrollHeight,
      });

      const searchResults = document.querySelector(
        ".fx-relay-menu-masks-search-results"
      );
      const searchResultsList = searchResults.querySelector("ul");

      // Check if user may have custom domain masks
      const { premiumSubdomainSet } = await browser.storage.local.get(
        "premiumSubdomainSet"
      );

      // API Note: If a user has not registered a subdomain yet, its default stored/queried value is "None";
      const isPremiumSubdomainSet = premiumSubdomainSet !== "None";

      const masks = await getMasks({
        fetchCustomMasks: isPremiumSubdomainSet,
      });

      // Process the masks list:
      if (masks.length === 0) {
        fxRelayMenuBody.classList.remove("is-loading");

        const search = document.querySelector(".fx-relay-menu-masks-search");
        search.classList.add("is-hidden");

      } else if (masks.length > 5) {

        // If there's at least 6 masks, show the search bar
        await populateMaskList(searchResults, masks, {
          replaceMaskAddressWithLabel: true,
        });

        searchResultsList.style.height = `${searchResultsList.offsetHeight}px`;

        const filterSearchForm = document.querySelector(
          ".fx-relay-menu-masks-search-form"
        );

        const filterSearchInput = filterSearchForm.querySelector(
          ".fx-relay-menu-masks-search-input"
        );

        filterSearchForm.addEventListener("submit", (event) => {
          event.preventDefault();
          filterSearchInput.blur();
        });

        filterSearchInput.addEventListener("input", (event) => {
          applySearchFilter(event.target.value);
        });

      } else {
        // User has between 1-5 masks. Display all of them, but
        // do not show the search input/filter.

        await populateMaskList(searchResults, masks, {
          replaceMaskAddressWithLabel: true,
        });

        const filterSearchForm = document.querySelector(
          ".fx-relay-menu-masks-search-form"
        );

        const filterSearchResults = document.querySelector(
          ".fx-relay-menu-masks-search-results"
        );

        filterSearchForm.remove();
        filterSearchResults.classList.add("t-no-search-bar");
      }

    
      const generateAliasBtn = document.querySelector(
        ".fx-relay-menu-generate-alias-btn"
      );

      // Set Generate Mask button
      await buildContent.components.generateMaskButton();

      fxRelayMenuBody.classList.remove("is-loading");

      // Resize iframe
      await browser.runtime.sendMessage({
        method: "updateIframeHeight",
        height: fxRelayMenuBody.scrollHeight,
      });

      const filterSearchInput = document.querySelector(
        ".fx-relay-menu-masks-search-input"
      );

      if (filterSearchInput) {
        // If there's a search bar visible, focus on that instead of the generate

        const searchFilterTotal = document.querySelector(
          ".js-filter-masks-total"
        );
        const searchFilterVisible = document.querySelector(
          ".js-filter-masks-visible"
        );

        searchFilterTotal.textContent = masks.length;
        searchFilterVisible.textContent = masks.length;

        filterSearchInput.focus();
        return;
      }

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
          throw new Error(browser.i18n.getMessage("pageInputIconMaxAliasesError_mask"));
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
        relayMenuDashboardLink.querySelector(".fx-relay-menu-dashboard-link-tooltip");
    
        relayMenuDashboardLinkTooltip.textContent =
        browser.i18n.getMessage("labelManage");
    
      relayMenuDashboardLink.href = `${relaySiteOrigin}?utm_source=fx-relay-addon&utm_medium=input-menu&utm_content=manage-all-addresses`;
      relayMenuDashboardLink.target = "_blank";
    
      relayMenuDashboardLink.addEventListener("click", async () => {
        sendInPageEvent("click", "input-menu-manage-all-aliases-btn");
        await iframeCloseRelayInPageMenu();
      });
    }
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
