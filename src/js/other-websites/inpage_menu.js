/* global preventDefaultBehavior */

function iframeCloseRelayInPageMenu() {
  document.removeEventListener("keydown", handleKeydownEvents);
  browser.runtime.sendMessage({method:"iframeCloseRelayInPageMenu"});
}

function getRelayMenuEl() {
  return document.querySelector(".fx-relay-menu");
}

let activeElemIndex = 0;
function handleKeydownEvents(e) {
  const relayInPageMenu = getRelayMenuEl();
  const clickableElsInMenu = relayInPageMenu.querySelectorAll("button, a");
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
    iframeCloseRelayInPageMenu();
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
    activeElemIndex = (clickableElsInMenu.length - 1);
  }
}

async function isUserSignedIn() {
  const userApiToken = await browser.storage.local.get("apiToken");
  return userApiToken.hasOwnProperty("apiToken");
}

async function inpageContentInit() {
  const sendInPageEvent = (evtAction, evtLabel) => {
    sendRelayEvent("In-page", evtAction, evtLabel);
  };

  const { relaySiteOrigin } = await browser.storage.local.get(
    "relaySiteOrigin"
  );

  // Set custom fonts from the add-on
  await setCustomFonts();

  const signedInUser = await isUserSignedIn();
  const signedOutContent = document.querySelector(".fx-content-signed-out");
  const signedInContent = document.querySelector(".fx-content-signed-in");

  document.addEventListener("keydown", handleKeydownEvents);

  if (!signedInUser) {
    signedOutContent.classList.remove("is-hidden");
    // Remove signed in content from DOM so there are no hidden/screen readable-elements available
    signedInContent.remove();

    const signUpMessageEl = document.querySelector(
      ".fx-relay-menu-sign-up-message"
    );

    signUpMessageEl.textContent = browser.i18n.getMessage(
      "pageInputIconSignUpText"
    );

    const signUpButton = document.querySelector(
      ".fx-relay-menu-sign-up-btn"
    );

    signUpButton.textContent = browser.i18n.getMessage(
      "pageInputIconSignUpButton"
    );

    signUpButton.addEventListener("click", async (clickEvt) => {
      preventDefaultBehavior(clickEvt);
      await browser.runtime.sendMessage({
        method: "openRelayHomepage",
      });
      sendInPageEvent("click", "input-menu-sign-up-btn");
      iframeCloseRelayInPageMenu();
    });

    sendInPageEvent("viewed-menu", "unauthenticated-user-input-menu");

    // Focus on "Go to Firefox Relay" button
    signUpButton.focus();

    return;
  }

  // Remove signed out content from DOM so there are no hidden/screen readable-elements available
  signedOutContent.remove();

  sendInPageEvent("viewed-menu", "authenticated-user-input-menu");
  
  // Create "Generate Relay Address" button
  const generateAliasBtn = document.querySelector(
    ".fx-relay-menu-generate-alias-btn"
  );

  generateAliasBtn.textContent = browser.i18n.getMessage(
    "pageInputIconGenerateNewAlias"
  );

  // Create "Get unlimited aliases" button
  const getUnlimitedAliasesBtn = document.querySelector(
    ".fx-relay-menu-get-unlimited-aliases"
  );
  getUnlimitedAliasesBtn.textContent = browser.i18n.getMessage(
    "popupGetUnlimitedAliases_mask"
  );

  // If the user has a premium accout, they may create unlimited aliases.
  const { premium } = await browser.storage.local.get("premium");

  // Create "You have .../.. remaining relay address" message
  const remainingAliasesSpan = document.querySelector(
    ".fx-relay-menu-remaining-aliases"
  );

  const { relayAddresses } = await browser.storage.local.get("relayAddresses");
  const { maxNumAliases } = await browser.storage.local.get("maxNumAliases");

  const numAliasesRemaining = maxNumAliases - relayAddresses.length;

  // Free user: Set text informing them how many aliases they can create
  remainingAliasesSpan.textContent = browser.i18n.getMessage(
    "popupRemainingAliases_2_mask",
    [numAliasesRemaining, maxNumAliases]
  );

  // Free user (who once was premium): Set text informing them how they have exceeded the maximum amount of aliases and cannot create any more
  if (numAliasesRemaining < 0) {
    remainingAliasesSpan.textContent = browser.i18n.getMessage(
      "pageFillRelayAddressLimit_mask"
    );
  }

  // Premium user: Set text informing them how many aliases they have created so far
  if (premium) {
    remainingAliasesSpan.textContent = browser.i18n.getMessage(
      "popupUnlimitedAliases_mask",
      [relayAddresses.length]
    );
  }

  const maxNumAliasesReached = numAliasesRemaining <= 0;

  // Create "Manage All Aliases" link
  const relayMenuDashboardLink = document.querySelector(
    ".fx-relay-menu-dashboard-link"
  );
  relayMenuDashboardLink.textContent = browser.i18n.getMessage("ManageAllAliases_mask");
  relayMenuDashboardLink.href = `${relaySiteOrigin}?utm_source=fx-relay-addon&utm_medium=input-menu&utm_content=manage-all-addresses`;
  relayMenuDashboardLink.addEventListener("click", () => {
    sendInPageEvent("click", "input-menu-manage-all-aliases-btn");
    iframeCloseRelayInPageMenu();
  });

  // Create "Get unlimited aliases" link
  getUnlimitedAliasesBtn.href = `${relaySiteOrigin}/premium?utm_source=fx-relay-addon&utm_medium=input-menu&utm_content=get-premium-link`;
  getUnlimitedAliasesBtn.addEventListener("click", () => {
    sendInPageEvent("click", "input-menu-get-premium-btn");
    iframeCloseRelayInPageMenu();
  });

  if (!premium) {
    if (maxNumAliasesReached) {
      generateAliasBtn.remove();
      sendInPageEvent("viewed-menu", "input-menu-max-aliases-message");
      remainingAliasesSpan.textContent = browser.i18n.getMessage(
        "pageFillRelayAddressLimit_mask",
        [numAliasesRemaining, maxNumAliases]
      );
      // Focus on "Get unlimited alias" button
      getUnlimitedAliasesBtn.focus();
    } else {
      // Focus on "Generate New Alias" button
      generateAliasBtn.focus();
    }
  } else {
    // Focus on "Generate New Alias" button
    generateAliasBtn.focus();
    getUnlimitedAliasesBtn.remove();
  }

  //Check if premium features are available
  const premiumCountryAvailability = (
    await browser.storage.local.get("premiumCountries")
  )?.premiumCountries;

  if (
    premiumCountryAvailability?.premium_available_in_country !== true ||
    !maxNumAliasesReached
  ) {
    getUnlimitedAliasesBtn.remove();
  }

  // Handle "Generate New Alias" clicks
  generateAliasBtn.addEventListener("click", async (generateClickEvt) => {
    sendInPageEvent("click", "input-menu-generate-alias");
    preventDefaultBehavior(generateClickEvt);

    // Request the active tab from the background script and parse the `document.location.hostname`
    const currentPageHostName = await browser.runtime.sendMessage({method: "getCurrentPageHostname"});

    // Attempt to create a new alias
    const newRelayAddressResponse = await browser.runtime.sendMessage({
      method: "makeRelayAddress",
      description: currentPageHostName 
    });

    const loadingImagePath = browser.runtime.getURL("/images/loader.svg");
    const loadingAnimationImage = document.querySelector(
      ".fx-relay-alias-loading-image img"
    );
    loadingAnimationImage.src = loadingImagePath;

    const relayInPageMenu = document.querySelector(".fx-relay-menu");

    relayInPageMenu.classList.add("fx-relay-alias-loading");

    // Catch edge cases where the "Generate New Alias" button is still enabled,
    // but the user has already reached the max number of aliases.
    if (newRelayAddressResponse.status === 402) {
      relayInPageMenu.classList.remove("fx-relay-alias-loading");
      // preserve menu height before removing child elements
      // TODO: Add background/function to adjust height of iframe
      relayInPageMenu.style.height = relayInPageMenu.clientHeight + "px";

      [generateAliasBtn, remainingAliasesSpan].forEach((el) => {
        el.remove();
      });

      const errorMessage = document.createElement("p");
      errorMessage.classList.add("fx-relay-error-message");

      errorMessage.textContent = browser.i18n.getMessage(
        "pageInputIconMaxAliasesError_mask",
        [relayAddresses.length]
      );

      relayInPageMenu.insertBefore(errorMessage, relayMenuDashboardLink);
      return;
    }

    await browser.runtime.sendMessage({
      method: "fillInputWithAlias",
      message: {
        filter: "fillInputWithAlias", 
        newRelayAddressResponse
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await inpageContentInit();
});
