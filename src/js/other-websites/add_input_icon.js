const RELAY_INPAGE_MENU_WIDTH = 320;

function closeRelayInPageMenu() {
  const relayIconBtn = document.querySelector(".fx-relay-menu-open");
  relayIconBtn?.classList.remove("fx-relay-menu-open");
  const openMenuEl = document.querySelector(".fx-relay-menu-wrapper");
  openMenuEl?.remove();
  window.removeEventListener("resize", positionRelayMenu);
  window.removeEventListener("scroll", positionRelayMenu);
  return;
}

function closeRelayInPageModal() {
  const openMenuEl = document.querySelector(".fx-relay-modal-iframe");
  openMenuEl.remove();
  // window.removeEventListener("resize", positionRelayMenu);
  // window.removeEventListener("scroll", positionRelayMenu);
  return;
}

function addRelayMenuToPage(relayMenuWrapper, relayInPageMenu) {
  relayMenuWrapper.appendChild(relayInPageMenu);
  document.body.appendChild(relayMenuWrapper);

  // Position menu according to the input icon's position
  positionRelayMenu();

  const relayInPageMenuIframe = document.querySelector(".fx-relay-menu-iframe iframe");
  relayInPageMenuIframe.ariaHidden = "false"
  relayInPageMenuIframe.focus();
  return;
}

function addRelayModalToPage(relayInPageModal) {
  document.body.appendChild(relayInPageModal);

  const relayInPageModalIframe = document.querySelector(".fx-relay-modal-iframe iframe");
  relayInPageModalIframe.ariaHidden = "false"
  relayInPageModalIframe.focus();

  return;
}

function positionRelayMenu() {
  const relayInPageMenu = document.querySelector(".fx-relay-menu-iframe");
  const relayIconBtn = document.querySelector(".fx-relay-menu-open");

  if (!relayIconBtn) {
    // BUGFIX: Catch erroneous/duplicate positionRelayMenu() calls before menu is open
    return;
  }

  const relayInPageMenuIframe = document.querySelector(".fx-relay-menu-iframe");
  const newIconPosition = relayIconBtn.getBoundingClientRect();
  const documentPosition = document.documentElement.getBoundingClientRect();
  const RELAY_INPAGE_MENU_MAXIMUM_HEIGHT = 435
  
  // Calculate the "safe area" of add-on in-page menu. If there's not enough room to expand below the icon, it expands above. 
  // The RELAY_INPAGE_MENU_MAXIMUM_HEIGHT / 405 is the pixel height of the tallest version of the inpage menu. 
  const positionMenuBelowIcon = ((((newIconPosition.top - documentPosition.top) - document.documentElement.scrollHeight) * -1) > RELAY_INPAGE_MENU_MAXIMUM_HEIGHT);

  function _setPositionX (newIconPosition) {
    // This sets the inpage menu slightly offset from the Relay icon in the email input
    // This function checks to make sure there's enough space for that offset
    const offsetX = (window.innerWidth < 500) ? (RELAY_INPAGE_MENU_WIDTH - 32) : 255
    return newIconPosition.x - offsetX + "px";
  }

  if (positionMenuBelowIcon) {
    relayInPageMenu.style.left = _setPositionX(newIconPosition);
    relayInPageMenu.style.top = newIconPosition.top + 40 + "px";
    relayInPageMenuIframe.classList.remove("is-position-bottom");
  } else {
    relayInPageMenu.style.left = _setPositionX(newIconPosition);
    const relayInPageMenuIframeElement = document.querySelector(".fx-relay-menu-iframe iframe");
    relayInPageMenuIframe.classList.add("is-position-bottom")
    relayInPageMenu.style.top = newIconPosition.top - relayInPageMenuIframeElement.clientHeight - 20 + "px";
  }

  // Set arrow pointing to logo based on screenwidth
  relayInPageMenuIframe.classList.remove("is-position-right");
  if (window.innerWidth < 500) {
    relayInPageMenuIframe.classList.add("is-position-right");
  }
}

// This function is defined as global in the ESLint config _because_ it is created here:
// eslint-disable-next-line no-redeclare
function createElementWithClassList(elemType, elemClass) {
  const newElem = document.createElement(elemType);
  newElem.classList.add(elemClass);
  return newElem;
}

async function isUserSignedIn() {
  const userApiToken = await browser.storage.local.get("apiToken");
  return Object.prototype.hasOwnProperty.call(userApiToken, "apiToken");
}

function buildInpageIframe(opts) {
  const div = createElementWithClassList(
    "div",
    "fx-relay-menu-iframe"
  );
  const iframe = document.createElement("iframe");
  iframe.src = browser.runtime.getURL("inpage-panel.html");
  iframe.width = RELAY_INPAGE_MENU_WIDTH;
  // This height is derived from the Figma file. However, this is just the starting instance of the iframe/inpage menu. After it's built out, it resizes itself based on the inner contents.
  iframe.height = 300;
  iframe.title = browser.i18n.getMessage("pageInputTitle");
  iframe.tabIndex = 0;
  iframe.ariaHidden = "false";
  
  if (!opts.isSignedIn) {
    // If the user is not signed in, the content is shorter. Build the iframe accordingly.
    iframe.height = 200;
  }

  div.appendChild(iframe);
  
  return div;
}

function buildInPageModalIframe() {
  const div = createElementWithClassList(
    "div",
    "fx-relay-modal-iframe"
  );
  const iframe = document.createElement("iframe");
  iframe.src = browser.runtime.getURL("inpage-modal.html");
  iframe.width = 500;
  // This height is derived from the Figma file. However, this is just the starting instance of the iframe/inpage menu. After it's built out, it resizes itself based on the inner contents.
  // iframe.height = 210;
  iframe.title = "This is a modal";
  iframe.tabIndex = 0;
  iframe.classList.add("gh-fit");
  iframe.ariaHidden = "false";
  console.log(iframe);

  // if (!opts.isSignedIn) {
  //   // If the user is not signed in, the content is shorter. Build the iframe accordingly.
  //   iframe.height = 200;
  // }
  iframe.addEventListener("load", requestAnimationFrame.bind(this, fit))

  div.appendChild(iframe);
  
  return div;
}

function fit() {
  var iframes = document.querySelectorAll("iframe.gh-fit")

  for(var id = 0; id < iframes.length; id++) {
      var win = iframes[id].contentWindow
      var doc = win.document
      var html = doc.documentElement
      var body = doc.body
      var ifrm = iframes[id] // or win.frameElement

      if(body) {
          body.style.overflowX = "scroll" // scrollbar-jitter fix
          body.style.overflowY = "hidden"
      }
      if(html) {
          // html.style.overflowX = "scroll" // scrollbar-jitter fix
          html.style.overflowY = "hidden"
          var style = win.getComputedStyle(html)
          ifrm.height = parseInt(style.getPropertyValue("height"))
      }
  }

  requestAnimationFrame(fit)
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
  relayIconBtn.title = browser.i18n.getMessage("pageInputIconGenerateNewAlias_mask");
  const makeNewAliasImagePath = browser.runtime.getURL('/images/logo-image-fx-relay.svg');
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



  emailInput.addEventListener("click", async (e) => {
    if (!e.isTrusted) {
      // The click was not user generated so ignore
      return false;
    }
    lastClickedEmailInput = emailInput;

    const relayModal = document.querySelector(".fx-relay-modal-iframe");

    if (!relayModal) {
      const relayInPageModal = buildInPageModalIframe();
      addRelayModalToPage(relayInPageModal);
      emailInput.classList.toggle("fx-relay-modal-open");
    }
    return;
  });


  relayIconBtn.addEventListener("click", async (e) => {
    if (!e.isTrusted) {
      // The click was not user generated so ignore
      return false;
    }

    lastClickedEmailInput = emailInput;
    sendInPageEvent("input-icon-clicked", "input-icon");

    preventDefaultBehavior(e);
    window.addEventListener("resize", positionRelayMenu);
    window.addEventListener("scroll", positionRelayMenu);

    const signedInUser = await isUserSignedIn();
    const relayInPageMenu = buildInpageIframe({isSignedIn: signedInUser});
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

function updateIframeHeight(height) {
  const relayInPageMenuIframe = document.querySelector(".fx-relay-menu-iframe iframe");

  // BUG: Console error in background.js being called. The code below solves it. 
  if (relayInPageMenuIframe) {
    relayInPageMenuIframe.height = height;
  }

}

browser.runtime.onMessage.addListener(function(m, _sender, _sendResponse) {
  if (m.filter == "fillInputWithAlias") {
    fillInputWithAlias(lastClickedEmailInput, m.newRelayAddressResponse);
    console.log(lastClickedEmailInput);
    const relayIconBtn = document.querySelector(".fx-relay-menu-open");
    relayIconBtn?.classList.add("user-generated-relay");
    return closeRelayInPageMenu();
  }

  // This event is fired from the iframe when the user presses "Escape" key or completes an action (Generate alias, manage aliases)
  if (m.message === "iframeCloseRelayInPageMenu") {
      return closeRelayInPageMenu();
  }  
  // This event is fired from the iframe when the user presses "Escape" key or completes an action (Generate alias, manage aliases)
  if (m.message === "iframeCloseRelayInPageModal") {
    return closeRelayInPageModal();
} 

  // This event is fired from the iframe when the user presses "Escape" key or completes an action (Generate alias, manage aliases)
  if (m.method == "updateIframeHeight") {
    updateIframeHeight(m.height);
    positionRelayMenu();
  }  
});

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
