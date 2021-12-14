function closeRelayInPageMenu() {
  const relayIconBtn = document.querySelector(".fx-relay-menu-open");
  relayIconBtn.classList.remove("fx-relay-menu-open");
  const openMenuEl = document.querySelector(".fx-relay-menu-wrapper");
  openMenuEl.remove();
  restrictOrRestorePageTabbing(0);
  document.removeEventListener("keydown", handleKeydownEvents);
  window.removeEventListener("resize", positionRelayMenu);
  window.removeEventListener("scroll", positionRelayMenu);
  return;
}

function addRelayMenuToPage(relayMenuWrapper, relayInPageMenu, relayIconBtn) {
  relayMenuWrapper.appendChild(relayInPageMenu);
  document.body.appendChild(relayMenuWrapper);

  // Position menu according to the input icon's position
  positionRelayMenu();
  relayIconBtn.focus();
  return;
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

function positionRelayMenu() {
  const relayInPageMenu = getRelayMenuEl();
  const relayIconBtn = document.querySelector(".fx-relay-menu-open");
  const newIconPosition = relayIconBtn.getBoundingClientRect();
  relayInPageMenu.style.left = newIconPosition.x - 255 + "px";
  relayInPageMenu.style.top = newIconPosition.top + 40 + "px";
}

let activeElemIndex = -1;
function handleKeydownEvents(e) {
  const relayInPageMenu = getRelayMenuEl();
  const clickableElsInMenu = relayInPageMenu.querySelectorAll("button, a");
  const relayButton = document.querySelector(".fx-relay-button");
  const watchedKeys = ["Escape", "ArrowDown", "ArrowUp", "Tab"];
  const watchedKeyClicked = watchedKeys.includes(e.key);

  if (e.key === "Escape") {
    preventDefaultBehavior(e);
    return closeRelayInPageMenu();
  }

  if (e.key === "ArrowDown" || (e.key === "Tab" && e.shiftKey === false)) {
    preventDefaultBehavior(e);
    activeElemIndex += 1;
  }

  if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey === true)) {
    preventDefaultBehavior(e);
    activeElemIndex -= 1;
  }

  if (clickableElsInMenu[activeElemIndex] !== undefined && watchedKeyClicked) {
    return clickableElsInMenu[activeElemIndex].focus();
  }

  if (watchedKeyClicked) {
    activeElemIndex = -1;
    relayButton.focus();
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

function addPaddingRight(element, paddingInPixels) {
  const computedElementStyles = getComputedStyle(element);
  const existingPaddingRight =
    computedElementStyles.getPropertyValue("padding-right");
  const existingPaddingRightInPixels = Number.parseInt(
    existingPaddingRight.replace("px", ""),
    10
  );
  const newPaddingRight = existingPaddingRightInPixels + paddingInPixels;
  element.style.paddingRight = newPaddingRight.toString() + "px";

  // If the element's box-sizing is content-box, adding padding will increase the element's width.
  // Therefore, we'll have to decrease the set width with the same amount to keep the effective
  // width the same.
  if (computedElementStyles.getPropertyValue("box-sizing") === "content-box") {
    const existingWidth = computedElementStyles.getPropertyValue("width");
    const existingWidthInPixels = Number.parseInt(
      existingWidth.replace("px", ""),
      10
    );
    const newWidth = existingWidthInPixels - paddingInPixels;
    element.style.width = newWidth.toString() + "px";
  }
}

function premiumFeaturesAvailable(premiumEnabledString) {
  if (premiumEnabledString === "True") {
    return true;
  }
  return false;
}

async function addRelayIconToInput(emailInput) {
  const { relaySiteOrigin } = await browser.storage.local.get(
    "relaySiteOrigin"
  );
  // remember the input's original parent element;
  const emailInputOriginalParentEl = emailInput.parentElement;

  // create new wrapping element;
  const emailInputWrapper = createElementWithClassList(
    "div",
    "fx-relay-email-input-wrapper"
  );
  emailInputOriginalParentEl.insertBefore(emailInputWrapper, emailInput);

  // add padding to the input so that input text
  // is not covered up by the Relay icon
  addPaddingRight(emailInput, 30);
  emailInputWrapper.appendChild(emailInput);

  const computedInputStyles = getComputedStyle(emailInput);
  const inputHeight = emailInput.offsetHeight;

  const divEl = createElementWithClassList("div", "fx-relay-icon");

  const bottomMargin = parseInt(
    computedInputStyles.getPropertyValue("margin-bottom"),
    10
  );
  const topMargin = parseInt(
    computedInputStyles.getPropertyValue("margin-top"),
    10
  );

  divEl.style.height =
    computedInputStyles.height - bottomMargin - topMargin + "px";

  divEl.style.top = topMargin;
  divEl.style.bottom = `${bottomMargin}px`;

  const relayIconBtn = createElementWithClassList("button", "fx-relay-button");
  relayIconBtn.id = "fx-relay-button";
  relayIconBtn.type = "button";
  relayIconBtn.title = browser.i18n.getMessage("pageInputIconGenerateNewAlias");

  const relayIconHeight = 30;
  if (relayIconHeight > inputHeight) {
    const smallIconSize = "24px";
    relayIconBtn.style.height = smallIconSize;
    relayIconBtn.style.width = smallIconSize;
    relayIconBtn.style.minWidth = smallIconSize;
    emailInput.style.paddingRight = "30px";
    divEl.style.right = "2px";
  }

  const sendInPageEvent = (evtAction, evtLabel) => {
    sendRelayEvent("In-page", evtAction, evtLabel);
  };

  relayIconBtn.addEventListener("click", async (e) => {
    sendInPageEvent("input-icon-clicked", "input-icon");

    preventDefaultBehavior(e);
    window.addEventListener("resize", positionRelayMenu);
    window.addEventListener("scroll", positionRelayMenu);
    document.addEventListener("keydown", handleKeydownEvents);

    const relayInPageMenu = createElementWithClassList("div", "fx-relay-menu");
    const relayMenuWrapper = createElementWithClassList(
      "div",
      "fx-relay-menu-wrapper"
    );

    // Close menu if the user clicks outside of the menu
    relayMenuWrapper.addEventListener("click", closeRelayInPageMenu);

    // Close menu if it's already open
    relayIconBtn.classList.toggle("fx-relay-menu-open");
    if (!relayIconBtn.classList.contains("fx-relay-menu-open")) {
      return closeRelayInPageMenu();
    }

    const signedInUser = await isUserSignedIn();

    if (!signedInUser) {
      const signUpMessageEl = createElementWithClassList(
        "span",
        "fx-relay-menu-sign-up-message"
      );
      signUpMessageEl.textContent = browser.i18n.getMessage(
        "pageInputIconSignUpText"
      );

      relayInPageMenu.appendChild(signUpMessageEl);
      const signUpButton = createElementWithClassList(
        "button",
        "fx-relay-menu-sign-up-btn"
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
        closeRelayInPageMenu();
      });
      relayInPageMenu.appendChild(signUpButton);

      addRelayMenuToPage(relayMenuWrapper, relayInPageMenu, relayIconBtn);
      sendInPageEvent("viewed-menu", "unauthenticated-user-input-menu");
      return;
    }

    sendInPageEvent("viewed-menu", "authenticated-user-input-menu");
    // Create "Generate Relay Address" button
    const generateAliasBtn = createElementWithClassList(
      "button",
      "fx-relay-menu-generate-alias-btn"
    );
    generateAliasBtn.textContent = browser.i18n.getMessage(
      "pageInputIconGenerateNewAlias"
    );

    // Create "Get unlimited aliases" button
    const getUnlimitedAliasesBtn = createElementWithClassList(
      "a",
      "fx-relay-menu-get-unlimited-aliases"
    );
    getUnlimitedAliasesBtn.textContent = browser.i18n.getMessage(
      "popupGetUnlimitedAliases"
    );
    getUnlimitedAliasesBtn.setAttribute("target", "_blank");
    getUnlimitedAliasesBtn.setAttribute("rel", "noopener noreferrer");

    // If the user has a premium accout, they may create unlimited aliases.
    const { premium } = await browser.storage.local.get("premium");

    // Create "You have .../.. remaining relay address" message
    const remainingAliasesSpan = createElementWithClassList(
      "span",
      "fx-relay-menu-remaining-aliases"
    );
    const { relayAddresses } = await browser.storage.local.get(
      "relayAddresses"
    );
    const { maxNumAliases } = await browser.storage.local.get("maxNumAliases");

    const numAliasesRemaining = maxNumAliases - relayAddresses.length;

    // Free user: Set text informing them how many aliases they can create
    remainingAliasesSpan.textContent = browser.i18n.getMessage(
      "popupRemainingAliases-2",
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
    const relayMenuDashboardLink = createElementWithClassList(
      "a",
      "fx-relay-menu-dashboard-link"
    );
    relayMenuDashboardLink.textContent =
      browser.i18n.getMessage("ManageAllAliases");
    relayMenuDashboardLink.href = `${relaySiteOrigin}?utm_source=fx-relay-addon&utm_medium=input-menu&utm_content=manage-all-addresses`;
    relayMenuDashboardLink.target = "_blank";
    relayMenuDashboardLink.addEventListener("click", () => {
      sendInPageEvent("click", "input-menu-manage-all-aliases-btn");
    });

    //Create "Get unlimited aliases" link
    const { fxaSubscriptionsUrl } = await browser.storage.local.get(
      "fxaSubscriptionsUrl"
    );
    const { premiumProdId } = await browser.storage.local.get("premiumProdId");
    const { premiumPriceId } = await browser.storage.local.get(
      "premiumPriceId"
    );
    getUnlimitedAliasesBtn.href = `${fxaSubscriptionsUrl}/products/${premiumProdId}?plan=${premiumPriceId}`;

    // Restrict tabbing to relay menu elements
    restrictOrRestorePageTabbing(-1);

    // Append menu elements to the menu
    [
      remainingAliasesSpan,
      getUnlimitedAliasesBtn,
      generateAliasBtn,
      relayMenuDashboardLink,
    ].forEach((el) => {
      relayInPageMenu.appendChild(el);
    });

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
    const premiumEnabled = await browser.storage.local.get("premiumEnabled");
    const premiumEnabledString = premiumEnabled.premiumEnabled;
    const premiumCountryAvailability = (await browser.storage.local.get("premiumCountries"))?.premiumCountries;

    if (
      !premiumFeaturesAvailable(premiumEnabledString) ||
      premiumCountryAvailability?.premium_available_in_country !== true ||
      !maxNumAliasesReached
    ) {
      getUnlimitedAliasesBtn.remove();
    }

    // Handle "Generate New Alias" clicks
    generateAliasBtn.addEventListener("click", async (generateClickEvt) => {
      sendInPageEvent("click", "input-menu-generate-alias");
      preventDefaultBehavior(generateClickEvt);

      // Attempt to create a new alias
      const newRelayAddressResponse = await browser.runtime.sendMessage({
        method: "makeRelayAddress",
        description: document.location.hostname,
      });

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

      setTimeout(() => {
        fillInputWithAlias(emailInput, newRelayAddressResponse);
        relayIconBtn.classList.add("user-generated-relay");
        closeRelayInPageMenu();
      }, 700);
    });

    addRelayMenuToPage(relayMenuWrapper, relayInPageMenu, relayIconBtn);
  });

  divEl.appendChild(relayIconBtn);
  emailInputWrapper.appendChild(divEl);
  sendInPageEvent("input-icon-injected", "input-icon");
}

function getEmailInputsAndAddIcon(domRoot) {
  const emailInputs = detectEmailInputs(domRoot);
  for (const emailInput of emailInputs) {
    if (
      !emailInput.parentElement.classList.contains(
        "fx-relay-email-input-wrapper"
      )
    ) {
      addRelayIconToInput(emailInput);
    }
  }
}

(async function () {
  const inputIconsAreEnabled = await areInputIconsEnabled();
  if (!inputIconsAreEnabled) {
    return;
  }
  // Catch all immediately findable email inputs
  getEmailInputsAndAddIcon(document);

  // Catch email inputs that only become findable after
  // the entire page (including JS/CSS/images/etc) is fully loaded.
  window.addEventListener("load", () => {
    getEmailInputsAndAddIcon(document);
  });

  // Create a MutationObserver to watch for dynamically generated email inputs
  const mutationObserver = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.target.tagName === "FORM") {
        getEmailInputsAndAddIcon(mutation.target);
      }
    });
  });

  mutationObserver.observe(document.body, { childList: true, subtree: true });
})();
