
run();

const RELAY_INPAGE_MENU_WIDTH = 320;

async function run() {
  // Don't run on Firefox accounts; creating a Relay mask there can result in
  // an endless loop of self-referencing accounts:
  if ([
    "https://accounts.stage.mozaws.net",
    "https://accounts.firefox.com",
  ].includes(document.location.origin)) {
    return;
  }
  const inputIconsAreEnabled = await areInputIconsEnabled();
  if (!inputIconsAreEnabled) {
    return;
  }
  const emailInputs = findEmailInputs(document);
  wireUpInputs(emailInputs);

  const potentialNewInputObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type !== "childList") {
        return;
      }
      for (const addedNode of mutation.addedNodes) {
        if (addedNode instanceof HTMLElement) {
          const addedEmailInputs = findEmailInputs(addedNode);
          wireUpInputs(addedEmailInputs);
        }
      }
    });
  });

  potentialNewInputObserver.observe(document.body, {
    subtree: true,
    childList: true,
  });
}

/**
 * @param {HTMLInputElement[]} emailInputs 
 * @returns void
 */
function wireUpInputs(emailInputs) {
  for (const input of emailInputs) {
    const computedStyles = getComputedStyle(input);
    // Chrome updates `computedStyles` as soon as we write to input.style,
    // so make static copies to base our new styles on:
    const existingStyles = {
      backgroundSize: computedStyles.backgroundSize,
      backgroundImage: computedStyles.backgroundImage,
      backgroundRepeat: computedStyles.backgroundRepeat,
      backgroundPosition: computedStyles.backgroundPosition,
      backgroundOrigin: computedStyles.backgroundOrigin,
    };
    const iconUrl = browser.runtime.getURL("/images/logo-image-fx-relay.svg");
    input.style.backgroundSize = existingStyles.backgroundSize + `, 25px`;
    input.style.backgroundImage =
      existingStyles.backgroundImage + `, url(${iconUrl})`;
    input.style.backgroundRepeat =
      existingStyles.backgroundRepeat + ", no-repeat";
    input.style.backgroundPosition =
      existingStyles.backgroundPosition +
      `, right calc(50% - ((${computedStyles.paddingTop} - ${computedStyles.paddingBottom}) / 2))`;
    input.style.backgroundOrigin =
      existingStyles.backgroundOrigin + ", content-box";
    input.removeEventListener("click", onEmailInputClick);
    input.addEventListener("click", onEmailInputClick);
    input.removeEventListener("mousemove", onEmailInputHover);
    input.addEventListener("mousemove", onEmailInputHover, { passive: true });

    const invisibleFocusableButton = document.createElement("button");
    invisibleFocusableButton.textContent = browser.i18n.getMessage(
      "pageInputIconGenerateNewAlias_mask"
    );
    // This button should not be considered a form's submit button:
    invisibleFocusableButton.setAttribute("type", "button");
    invisibleFocusableButton.style.border = "0px none";
    invisibleFocusableButton.style.clip = "rect(0px, 0px, 0px, 0px)";
    invisibleFocusableButton.style.clipPath = "inset(50%)";
    invisibleFocusableButton.style.height = "1px";
    invisibleFocusableButton.style.margin = "0px -1px -1px 0px";
    invisibleFocusableButton.style.overflow = "hidden";
    invisibleFocusableButton.style.padding = "0px";
    invisibleFocusableButton.style.position = "absolute";
    invisibleFocusableButton.style.width = "1px";
    invisibleFocusableButton.style.whiteSpace = "nowrap";
    invisibleFocusableButton.addEventListener("focus", () => {
      applyIconFocusStyle(input);
    });
    invisibleFocusableButton.addEventListener("blur", () => {
      applyIconBlurStyle(input);
    });
    invisibleFocusableButton.addEventListener("click", (event) => {
      event.preventDefault();
      openMenu(input);
    });
    input.insertAdjacentElement("afterend", invisibleFocusableButton);
    sendRelayEvent("In-page", "input-icon-injected", "input-icon");
  }
}

/**
 * @param {HTMLInputElement} element 
 * @returns number
 */
function getPaddingRight(element) {
  const elementStyles = getComputedStyle(element);
  return Number.parseInt(elementStyles.paddingRight.replace("px", ""), 10);
}

/**
 * @param {HTMLInputElement} element 
 * @param {{ x: number }} coords 
 * @returns boolean
 */
function intersectsRelayIcon(
  element,
  coords
) {
  return element.clientWidth - coords.x <= 25 + 2 * getPaddingRight(element);
}

/**
 * @param {MouseEvent} event 
 * @returns void
 */
function onEmailInputClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  if (!intersectsRelayIcon(target, { x: event.offsetX })) {
    return;
  }

  // Do not focus the input field
  event.preventDefault();
  openMenu(target);
}

/**
 * @param {HTMLInputElement} target 
 * @returns void
 */
function openMenu(target) {
  sendRelayEvent("In-page", "input-icon-clicked", "input-icon");
  // TODO: Trap focus inside the underlay.
  //       See e.g. https://css-tricks.com/a-css-approach-to-trap-focus-inside-of-an-element/
  const existingUnderlay = document.getElementById("relay-popover-underlay");
  const underlay = existingUnderlay ?? document.createElement("div");
  underlay.id = "relay-popover-underlay";
  underlay.style.display = "initial";
  underlay.style.position = "fixed";
  underlay.style.inset = "0";
  underlay.style.zIndex = "99999999";
  underlay.style.backgroundColor = "rgba(0, 0, 0, 0.1)";
  const existingIframe = underlay.querySelector("iframe");
  const iframe = existingIframe ?? document.createElement("iframe");
  iframe.src = browser.runtime.getURL("inpage-panel.html");
  iframe.style.position = "absolute";
  iframe.style.width = `${RELAY_INPAGE_MENU_WIDTH}px`;
  iframe.style.maxWidth = `95vw`;
  positionIframe(iframe, target);
  const onResizeWindow = () => {
    positionIframe(iframe, target);
  };
  window.addEventListener("resize", onResizeWindow);
  const onScroll = () => {
    positionIframe(iframe, target);
  };
  window.addEventListener("scroll", onScroll);

  /**
   * @param {unknown} message 
   */
  const onInsertMask = (message) => {
    if (
      typeof message === "object" &&
      typeof message?.filter === "string" &&
      message.filter === "fillInputWithAlias" &&
      typeof message.newRelayAddressResponse === "object" &&
      (
        typeof message.newRelayAddressResponse?.full_address === "string" ||
        typeof message.newRelayAddressResponse?.address === "string"
      )
    ) {
      // When generating a new mask, `newRelayAddressResponse` contains a mask object
      // with the `full_address` property. When selecting an existing mask,
      // however, it only has the properties `address` and `currentDomain`, but
      // `address` does contain the full address (i.e. including @mozmail.com):
      target.value = message.newRelayAddressResponse.full_address ?? message.newRelayAddressResponse.address;
      target.dispatchEvent(new Event("input", { bubbles: true }));
      closeMenu();
    }
  };
  browser.runtime.onMessage.addListener(onInsertMask);

  /**
   * There's still no good way to get browsers to resize iframes to their
   * contents — packages like iframe-resizer are stil in use… However, we just
   * have the page in the iframe report its height to use whenever it resizes,
   * and update accordingly:
   * @param {unknown} message 
   */
  const onUpdateIframeHeight = (message) => {
    if (
      typeof message === "object" &&
      typeof message?.method === "string" &&
      message.method === "updateIframeHeight" &&
      typeof message?.height !== "undefined"
    ) {
      iframe.style.height = `${message.height}px`;
    }
  };
  browser.runtime.onMessage.addListener(onUpdateIframeHeight);

  /**
   * @param {MouseEvent} _event 
   */
  const onUnderlayClick = (_event) => {
    closeMenu();
  };
  underlay.addEventListener("click", onUnderlayClick);

  /**
   * @param {KeyboardEvent} event 
   */
  const onKeydown = (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  };
  document.body.addEventListener("keydown", onKeydown, { passive: true });
  /**
   * @param {MouseEvent} _event 
   */
  const onCloseMenuMessage = (message) => {
    if (typeof message === "object" && typeof message?.message === "string" && message.message === "iframeCloseRelayInPageMenu") {
      closeMenu();
    }
  };
  browser.runtime.onMessage.addListener(onCloseMenuMessage)

  const closeMenu = () => {
    document.body.removeEventListener("keydown", onKeydown);
    window.removeEventListener("resize", onResizeWindow);
    window.removeEventListener("scroll", onScroll);
    browser.runtime.onMessage.removeListener(onInsertMask);
    browser.runtime.onMessage.removeListener(onUpdateIframeHeight);
    browser.runtime.onMessage.removeListener(onCloseMenuMessage);
    const underlay = document.getElementById("relay-popover-underlay");
    if (underlay) {
      underlay.style.display = "none";
      underlay.removeEventListener("click", onUnderlayClick);
    }
  };

  if (!existingIframe) {
    underlay.appendChild(iframe);
  }
  if (!existingUnderlay) {
    document.body.appendChild(underlay);
  }
  iframe.contentWindow?.focus();
  browser.storage.local.get("apiToken").then(userApiToken => {
    const isSignedIn = Object.prototype.hasOwnProperty.call(userApiToken, "apiToken");
    sendRelayEvent(
      "In-page",
      "viewed-menu",
      isSignedIn
        ?  "authenticated-user-input-menu"
        : "unauthenticated-user-input-menu"
    );
  });
}

/**
 * @param {HTMLIFrameElement} iframe 
 * @param {HTMLInputElement} target 
 * @returns void
 */
function positionIframe(iframe, target) {
  const elementBounds = target.getBoundingClientRect();
  iframe.style.top = `${elementBounds.bottom}px`;
  if (elementBounds.right < RELAY_INPAGE_MENU_WIDTH) {
    // If the right-hand side of the input is closer to the left-hand side of
    // the page than the menu is wide, align the left-hand side of the menu with
    // the left-hand side of the input:
    iframe.style.left = `${elementBounds.left}px`;
    iframe.style.right = "";
  } else {
    // But otherwise, we can just align the right-hand side of the menu with the
    // right-hand side of the input, to keep it close to the button:
    iframe.style.left = "";
    iframe.style.right = `calc(100vw - ${elementBounds.right}px)`;
  }
}

/**
 * @param {MouseEvent} event 
 * @returns void
 */
function onEmailInputHover(event) {
  const element = event.target;
  if (!(element instanceof HTMLInputElement)) {
    return;
  }

  // Apply the above styles only when the cursor hovers the Relay icon:
  if (intersectsRelayIcon(element, { x: event.offsetX })) {
    applyIconHoverStyle(element);
  } else {
    applyIconUnhoverStyle(element);
  }
}

/**
 * Whenever the Relay icon is hovered, we add class styles for the <input>
 * element that icon is in that activate on hover or blur.
 *
 * Since these styles are specific to that element (because they preserve its
 * existing styles), this function has to be called on every hover — otherwise,
 * the class might have its styles defined for a different <input>.
 *
 * @param {HTMLInputElement} element
 */
function setHoverStyles(element) {
  // Styles to add hover effects (background glow and a pointer cursor),
  // while preserving the existing background styles for this element:
  const elementStyles = getComputedStyle(element);
  const hoverBackgroundStyle =
    elementStyles.backgroundImage +
    `, linear-gradient(to left, #f68fff ${
      getPaddingRight(element) * 2 + 25
    }px, transparent 1px, transparent)`;
  // The `!important` is to override the inline styles we set in `run()`:
  const emailInputHoverStyles = `
    .relay-email-input-with-button-hovered:hover {
      background-image: ${hoverBackgroundStyle} !important;
      cursor: pointer;
    }
  `;
  const existingStyleElement = document.getElementById(
    "relay-email-input-hover-styles"
  );
  const styleElementToSet =
    existingStyleElement ?? document.createElement("style");
  styleElementToSet.id = "relay-email-input-hover-styles";
  styleElementToSet.textContent = emailInputHoverStyles;
  if (!existingStyleElement) {
    document.head.appendChild(styleElementToSet);
  }
}

/**
 * @param {HTMLInputElement} element 
 */
function applyIconHoverStyle(element) {
  setHoverStyles(element);
  element.classList.add("relay-email-input-with-button-hovered");
}

/**
 * @param {HTMLInputElement} element 
 */
function applyIconUnhoverStyle(element) {
  element.classList.remove("relay-email-input-with-button-hovered");
}

/**
 * @param {HTMLInputElement} element 
 */
function setFocusStyles(element) {
  // Styles to add focus effects,
  // while preserving the existing background styles for this element:
  const computedStyles = getComputedStyle(element);
  const elementStyles = {
    backgroundImage: computedStyles.backgroundImage,
    backgroundSize: computedStyles.backgroundSize,
    backgroundPosition: computedStyles.backgroundPosition,
    backgroundRepeat: computedStyles.backgroundRepeat,
  };
  const underlineWidth = getPaddingRight(element) * 2 + 25;
  const emailInputHoverStyles = `
    .relay-email-input-with-button-focused {
      background-image: ${
        elementStyles.backgroundImage
      }, linear-gradient(#f770ff, #f770ff) !important;
      background-size: ${
        elementStyles.backgroundSize
      }, ${underlineWidth.toString()}px 3px !important;
      background-position: ${
        elementStyles.backgroundPosition
      }, bottom right !important;
      background-repeat: ${
        elementStyles.backgroundRepeat
      }, no-repeat !important;
    }
  `;
  const existingStyleElement = document.getElementById(
    "relay-email-input-focus-styles"
  );
  const styleElementToSet =
    existingStyleElement ?? document.createElement("style");
  styleElementToSet.id = "relay-email-input-focus-styles";
  styleElementToSet.textContent = emailInputHoverStyles;
  if (!existingStyleElement) {
    document.head.appendChild(styleElementToSet);
  }
}

/**
 * @param {HTMLInputElement} element 
 */
function applyIconFocusStyle(element) {
  setFocusStyles(element);
  element.classList.add("relay-email-input-with-button-focused");
}

/**
 * @param {HTMLInputElement} element 
 */
function applyIconBlurStyle(element) {
  element.classList.remove("relay-email-input-with-button-focused");
}
