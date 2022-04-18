/* global preventDefaultBehavior */

function iframeCloseRelayInPageMenu() {
  document.removeEventListener("keydown", handleKeydownEvents);
  browser.runtime.sendMessage({ method: "iframeCloseRelayInPageMenu" });
}

function getRelayMenuEl() {
  return document.querySelector(".fx-relay-menu-body");
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
    activeElemIndex = clickableElsInMenu.length - 1;
  }
}

async function isUserSignedIn() {
  const userApiToken = await browser.storage.local.get("apiToken");
  return userApiToken.hasOwnProperty("apiToken");
}

async function getMasks() {
  const serverStoragePref = await browser.runtime.sendMessage({
    method: "getServerStoragePref",
  });

  if (serverStoragePref) {
    try {
      return await browser.runtime.sendMessage({
        method: "getAliasesFromServer",
      });
    } catch (error) {
      // API Error — Fallback to local storage
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
  // sendInPageEvent("click", "input-menu-generate-alias");
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

async function populateMaskList(maskList, masks) {
  const list = maskList.querySelector("ul");

  if (masks.length === 0) {
    maskList.remove();
    return;
  }

  masks.forEach((mask) => {
    const listItem = document.createElement("li");
    const listButton = document.createElement("button");

    listButton.tabIndex = 0;
    listButton.dataset.mask = mask.full_address;

    if (mask.description) {
      listButton.textContent = mask.description;
    } else {
      listButton.textContent = mask.full_address;
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

  await browser.runtime.sendMessage({
    method: "updateIframeHeight",
    height: document.getElementById("fxRelayMenuBody").scrollHeight,
  });
}

const sendInPageEvent = (evtAction, evtLabel) => {
  sendRelayEvent("In-page", evtAction, evtLabel);
};

async function inpageContentInit() {
  const { relaySiteOrigin } = await browser.storage.local.get(
    "relaySiteOrigin"
  );

  // Set custom fonts from the add-on
  await setCustomFonts();

  const signedInUser = await isUserSignedIn();
  const signedOutContent = document.querySelector(".fx-content-signed-out");
  const signedInContentFree = document.querySelector(
    ".fx-content-signed-in-free"
  );
  const signedInContentPremium = document.querySelector(
    ".fx-content-signed-in-premium"
  );

  document.addEventListener("keydown", handleKeydownEvents);

  if (!signedInUser) {
    signedOutContent?.classList.remove("is-hidden");
    // Remove signed in content from DOM so there are no hidden/screen readable-elements available
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
      iframeCloseRelayInPageMenu();
    });

    sendInPageEvent("viewed-menu", "unauthenticated-user-input-menu");

    // Focus on "Go to Firefox Relay" button
    signUpButton.focus();

    // Bug: There's a race condition on how fast to detect the iframe being loaded. The setTimeout solves it for now.
    setTimeout(async () => {
      await browser.runtime.sendMessage({
        method: "updateIframeHeight",
        height: document.getElementById("fxRelayMenuBody").scrollHeight,
      });
    }, 10);

    return;
  }

  // Remove signed out content from DOM so there are no hidden/screen readable-elements available
  signedOutContent.remove();

  // If the user has a premium accout, they may create unlimited aliases.
  const { premium } = await browser.storage.local.get("premium");

  if (premium) {
    // User is signed in/premium: Remove the free section from DOM so there are no hidden/screen readable-elements available
    signedInContentPremium?.classList.remove("is-hidden");
    signedInContentFree?.remove();
  } else {
    // User is signed in/free: Remove the premium section from DOM so there are no hidden/screen readable-elements available
    signedInContentFree?.classList.remove("is-hidden");
    signedInContentPremium?.remove();
  }

  sendInPageEvent("viewed-menu", "authenticated-user-input-menu");

  // Create "Generate Relay Address" button
  const generateAliasBtn = document.querySelector(
    ".fx-relay-menu-generate-alias-btn"
  );

  generateAliasBtn.textContent = browser.i18n.getMessage(
    "pageInputIconGenerateNewAlias_mask"
  );

  // Create "Get unlimited aliases" button
  const getUnlimitedAliasesBtn = document.querySelector(
    ".fx-relay-menu-get-unlimited-aliases"
  );

  getUnlimitedAliasesBtn.textContent = browser.i18n.getMessage(
    "popupGetUnlimitedAliases_mask"
  );

  // Create "You have .../.. remaining relay address" message
  const remainingAliasesSpan = document.querySelector(
    ".fx-relay-menu-remaining-aliases"
  );

  const { maxNumAliases } = await browser.storage.local.get("maxNumAliases");

  const maskLists = document.querySelectorAll(".fx-relay-menu-masks-list");
  const masks = await getMasks();

  maskLists?.forEach(async (maskList) => {
    // Set Mask List label names
    const label = maskList.querySelector(".fx-relay-menu-masks-list-label");
    const stringId = label.dataset.stringId;
    label.textContent = browser.i18n.getMessage(stringId);

    // Populate mask lists
    await populateMaskList(maskList, masks);
  });

  const numAliasesRemaining = maxNumAliases - masks.length;

  // Free user: Set text informing them how many aliases they can create
  remainingAliasesSpan.textContent = browser.i18n.getMessage(
    "popupRemainingAliases_2_mask",
    [numAliasesRemaining, maxNumAliases]
  );

  // Premium user: Set text informing them how many aliases they have created so far
  if (premium) {
    remainingAliasesSpan.textContent = browser.i18n.getMessage(
      "popupUnlimitedAliases_mask",
      [masks.length]
    );
  }

  const maxNumAliasesReached = numAliasesRemaining <= 0;

  // Create "Manage All Aliases" link
  const relayMenuDashboardLink = document.querySelector(
    ".fx-relay-menu-dashboard-link"
  );

  const relayMenuDashboardLinkSpan =
    relayMenuDashboardLink.querySelector("span");
  relayMenuDashboardLinkSpan.textContent =
    browser.i18n.getMessage("labelManage");
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
        "pageNoMasksRemaining"
      );

      getUnlimitedAliasesBtn.classList.remove("t-secondary");
      getUnlimitedAliasesBtn.classList.add("t-primary");
      // Focus on "Get unlimited alias" button
      getUnlimitedAliasesBtn.focus();

      document.querySelector(".fx-relay-menu-masks-lists").style.order = "2";
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

  // if (
  //   premiumCountryAvailability?.premium_available_in_country !== true ||
  //   !maxNumAliasesReached
  // ) {
  //   getUnlimitedAliasesBtn.remove();
  // }

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

    // const loadingImagePath = browser.runtime.getURL("/images/loader.svg");
    // const loadingAnimationImage = document.querySelector(
    //   ".fx-relay-alias-loading-image img"
    // );
    // loadingAnimationImage.src = loadingImagePath;

    // const relayInPageMenu = document.querySelector(".fx-relay-menu");

    // relayInPageMenu.classList.add("fx-relay-alias-loading");

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
        newRelayAddressResponse,
      },
    });
  });

  await browser.runtime.sendMessage({
    method: "updateIframeHeight",
    height: document.getElementById("fxRelayMenuBody").scrollHeight,
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await inpageContentInit();
});
