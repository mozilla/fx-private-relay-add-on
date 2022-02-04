function iframeCloseRelayInPageMenu() {
  // TODO: SEND MESSAGE TO CLOSE IFRAME
  // console.log("iframeCloseRelayInPageMenu");
}

function preventDefaultBehavior(clickEvt) {
  clickEvt.stopPropagation();
  clickEvt.stopImmediatePropagation();
  clickEvt.preventDefault();
  return;
}

function getRelayMenuEl() {
  return document.querySelector(".fx-relay-menu");
}

// let activeElemIndex = -1;
function handleKeydownEvents(e) {
  const relayInPageMenu = getRelayMenuEl();
  const clickableElsInMenu = relayInPageMenu.querySelectorAll("button, a");

  if (clickableElsInMenu[activeElemIndex] !== undefined && watchedKeyClicked) {
    return clickableElsInMenu[activeElemIndex].focus();
  }
}

// When restricting tabbing to Relay menu... tabIndexValue = -1
// When restoring tabbing to page elements... tabIndexValue = 0
function restrictOrRestorePageTabbing(tabIndexValue) {
  const allClickableEls = document.querySelectorAll(
    "button, a, input, select, option, textarea, [tabindex]"
  );
  allClickableEls.forEach((el) => {
    el.tabIndex = tabIndexValue;
  });
}

function createElementWithClassList(elemType, elemClass) {
  const newElem = document.createElement(elemType);
  newElem.classList.add(elemClass);
  return newElem;
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

  if (!signedInUser) {
    const signUpMessageEl = document.querySelector(
      ".fx-relay-menu-sign-up-message"
    );
    signUpMessageEl.textContent = browser.i18n.getMessage(
      "pageInputIconSignUpText"
    );

    const signUpButton = document.querySelector(
      ".fx-relay-menu-sign-up-message"
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
    return;
  }

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
    "popupGetUnlimitedAliases"
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
    "popupRemainingAliases_2",
    [numAliasesRemaining, maxNumAliases]
  );

  // Free user (who once was premium): Set text informing them how they have exceeded the maximum amount of aliases and cannot create any more
  if (numAliasesRemaining < 0) {
    remainingAliasesSpan.textContent = browser.i18n.getMessage(
      "pageFillRelayAddressLimit"
    );
  }

  // Premium user: Set text informing them how many aliases they have created so far
  if (premium) {
    remainingAliasesSpan.textContent = browser.i18n.getMessage(
      "popupUnlimitedAliases",
      [relayAddresses.length]
    );
  }

  const maxNumAliasesReached = numAliasesRemaining <= 0;

  // Create "Manage All Aliases" link
  const relayMenuDashboardLink = document.querySelector(
    ".fx-relay-menu-dashboard-link"
  );
  relayMenuDashboardLink.textContent = browser.i18n.getMessage("ManageAllAliases");
  relayMenuDashboardLink.href = `${relaySiteOrigin}?utm_source=fx-relay-addon&utm_medium=input-menu&utm_content=manage-all-addresses`;
  relayMenuDashboardLink.addEventListener("click", () => {
    sendInPageEvent("click", "input-menu-manage-all-aliases-btn");
  });

  // Create "Get unlimited aliases" link
  getUnlimitedAliasesBtn.href = `${relaySiteOrigin}/premium?utm_source=fx-relay-addon&utm_medium=input-menu&utm_content=get-premium-link`;

  // Restrict tabbing to relay menu elements
  restrictOrRestorePageTabbing(-1);

  if (!premium) {
    if (maxNumAliasesReached) {
      generateAliasBtn.remove();
      sendInPageEvent("viewed-menu", "input-menu-max-aliases-message");
      remainingAliasesSpan.textContent = browser.i18n.getMessage(
        "pageFillRelayAddressLimit",
        [numAliasesRemaining, maxNumAliases]
      );
    }
  } else {
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

    // In place of `document.location.hostname`
    const currentPage = await browser.runtime.sendMessage({method: "getCurrentPage"});
    
    chrome.runtime.sendMessage({ method: "getCurrentPage" }, tabId => {
      // console.log('My tabId is', tabId);
   });

    // Attempt to create a new alias
    const newRelayAddressResponse = await browser.runtime.sendMessage({
      method: "makeRelayAddress",
      description: currentPage
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
      relayInPageMenu.style.height = relayInPageMenu.clientHeight + "px";

      [generateAliasBtn, remainingAliasesSpan].forEach((el) => {
        el.remove();
      });

      const errorMessage = createElementWithClassList(
        "p",
        "fx-relay-error-message"
      );
      errorMessage.textContent = browser.i18n.getMessage(
        "pageInputIconMaxAliasesError",
        [relayAddresses.length]
      );

      relayInPageMenu.insertBefore(errorMessage, relayMenuDashboardLink);
      return;
    }

    setTimeout(async () => {
      await browser.runtime.sendMessage({
        method: "fillInputWithAlias",
        message: {
          filter: "fillInputWithAlias", 
          newRelayAddressResponse
        }
      });
    }, 700);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await inpageContentInit();
});
