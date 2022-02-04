function closeRelayInPageMenu() {
  const relayIconBtn = document.querySelector(".fx-relay-menu-open");
  relayIconBtn?.classList.remove("fx-relay-menu-open");
  const openMenuEl = document.querySelector(".fx-relay-menu-wrapper");
  openMenuEl?.remove();
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

function positionRelayMenu() {
  const relayInPageMenu = document.querySelector(".fx-relay-menu-iframe");
  const relayIconBtn = document.querySelector(".fx-relay-menu-open");
  const newIconPosition = relayIconBtn.getBoundingClientRect();
  relayInPageMenu.style.left = newIconPosition.x - 255 + "px";
  relayInPageMenu.style.top = newIconPosition.top + 40 + "px";
}

let activeElemIndex = -1;
function handleKeydownEvents(e) {
  // TODO: Migrate to iframe
  // const clickableElsInMenu = relayInPageMenu.querySelectorAll("button, a");
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

  // TODO: Migrate to iframe
  // if (clickableElsInMenu[activeElemIndex] !== undefined && watchedKeyClicked) {
  //   return clickableElsInMenu[activeElemIndex].focus();
  // }

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

function buildInpageIframe() {
  const div = createElementWithClassList(
    "div",
    "fx-relay-menu-iframe"
  );
  const iframe = document.createElement("iframe");
  iframe.src = browser.runtime.getURL("inpage-panel.html");
  iframe.width = 300;
  iframe.height = 205;
  iframe.dataset.something = "test";
  // iframe.sandbox = ["allow-scripts"];
  // iframe.scrolling = "no";

  div.appendChild(iframe);
  
  return div;
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


let lastClickedEmailInput;

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
  const makeNewAliasImagePath = browser.runtime.getURL('/icons/make-new-alias.png');
  relayIconBtn.style.backgroundImage = `url(${makeNewAliasImagePath})`;


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
    lastClickedEmailInput = emailInput;
    sendInPageEvent("input-icon-clicked", "input-icon");

    preventDefaultBehavior(e);
    window.addEventListener("resize", positionRelayMenu);
    window.addEventListener("scroll", positionRelayMenu);
    document.addEventListener("keydown", handleKeydownEvents);

    const relayInPageMenu = buildInpageIframe();
    const relayMenuWrapper = createElementWithClassList(
      "div",
      "fx-relay-menu-wrapper"
    );

    // Set custom fonts from the add-on
    // await setCustomFonts();

    // Close menu if the user clicks outside of the menu
    relayMenuWrapper.addEventListener("click", closeRelayInPageMenu);

    // Close menu if it's already open
    relayIconBtn.classList.toggle("fx-relay-menu-open");
    if (!relayIconBtn.classList.contains("fx-relay-menu-open")) {
      return closeRelayInPageMenu();
    }

    const signedInUser = await isUserSignedIn();

    if (!signedInUser) {
      addRelayMenuToPage(relayMenuWrapper, relayInPageMenu, relayIconBtn);
      sendInPageEvent("viewed-menu", "unauthenticated-user-input-menu");
      return;
    }

    sendInPageEvent("viewed-menu", "authenticated-user-input-menu");
    addRelayMenuToPage(relayMenuWrapper, relayInPageMenu, relayIconBtn);
  });

  divEl.appendChild(relayIconBtn);
  emailInputWrapper.appendChild(divEl);
  sendInPageEvent("input-icon-injected", "input-icon");
}

browser.runtime.onMessage.addListener(function(m, sender, sendResponse) {
  if (m.filter = "fillInputWithAlias") {
    // console.log("add_input_icon/fillInputWithAlias", sender, m);
    fillInputWithAlias(lastClickedEmailInput, m.newRelayAddressResponse);
    const relayIconBtn = document.querySelector(".fx-relay-menu-open");
    relayIconBtn?.classList.add("user-generated-relay");
    closeRelayInPageMenu();
  }
});

browser.runtime.sendMessage({method:"fillInputWithAliasParentPage"});

(async function () {

  function getEmailInputsAndAddIcon(domRoot) {
    let emailInputs = detectEmailInputs(domRoot);
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
