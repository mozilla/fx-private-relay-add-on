async function showModal(modalType) {
  const { relaySiteOrigin } = await browser.storage.local.get(
    "relaySiteOrigin"
  );
  const modalWrapper = document.createElement("div");
  modalWrapper.classList = ["fx-relay-modal-wrapper"];

  const modalContent = document.createElement("div");
  modalContent.classList = ["fx-relay-modal-content"];

  const logoWrapper = document.createElement("fx-relay-logo-wrapper");
  const logoMark = document.createElement("fx-relay-logomark");
  const logoType = document.createElement("fx-relay-logotype");

  [logoMark, logoType].forEach((customEl) => {
    logoWrapper.appendChild(customEl);
  });

  modalContent.appendChild(logoWrapper);

  const sendModalEvent = (evtAction, evtLabel) => {
    return sendRelayEvent("Modal", evtAction, evtLabel);
  };

  sendModalEvent("viewed-modal", "modal-max-aliases");
  const modalMessage = document.createElement("span");

  modalMessage.textContent = browser.i18n.getMessage(
    "pageFillRelayAddressLimit"
  );
  modalMessage.classList = ["fx-relay-modal-message"];
  modalContent.appendChild(modalMessage);

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

  //Create "Get unlimited aliases" link
  getUnlimitedAliasesBtn.href = `${relaySiteOrigin}/premium?utm_source=fx-relay-addon&utm_medium=context-menu&utm_content=get-premium-link`;

  modalContent.appendChild(getUnlimitedAliasesBtn);

  const manageAliasesLink = document.createElement("a");
  manageAliasesLink.textContent = browser.i18n.getMessage("ManageAllAliases");
  manageAliasesLink.classList = [
    "fx-relay-new-tab fx-relay-modal-manage-aliases",
  ];
  manageAliasesLink.href = `${relaySiteOrigin}?utm_source=fx-relay-addon&utm_medium=context-menu-modal&utm_content=manage-relay-addresses`;

  manageAliasesLink.addEventListener("click", async (e) => {
    e.preventDefault();
    sendModalEvent("click", "modal-manage-all-aliases-btn");
    return window.open(e.target.href);
  });
  modalContent.appendChild(manageAliasesLink);

  const modalCloseButton = document.createElement("button");
  modalCloseButton.classList = ["fx-relay-modal-close-button"];
  modalCloseButton.textContent = browser.i18n.getMessage("close");

  // Remove relay modal on button click
  modalCloseButton.addEventListener("click", () => {
    sendModalEvent("closed-modal", "modal-closed-btn");
    modalContent.remove();
  });

  // Remove relay modal on clicks outside of modal.
  modalWrapper.addEventListener("click", (e) => {
    const originalTarget = e.explicitOriginalTarget;
    if (originalTarget.classList.contains("fx-relay-modal-wrapper")) {
      sendModalEvent("closed-modal", "modal-closed-outside-click");
      modalWrapper.remove();
    }
  });

  modalWrapper.appendChild(modalContent);
  document.body.appendChild(modalWrapper);
  return;
}

// eslint-disable-next-line no-redeclare
function fillInputWithAlias(emailInput, relayAlias) {
  // BUG: Duplicate fillInputWithAlias calls without proper input content
  if (!emailInput || !relayAlias) {
    return false;
  }

  switch (relayAlias.domain) {
    case 1:
      emailInput.value = relayAlias.address + "@relay.firefox.com";
      break;
    case 2:
      emailInput.value = relayAlias.address + "@mozmail.com";
      break;
    default:
      // User does not sync data so no relayAlias.domain is available
      emailInput.value = relayAlias.address
      break;
  }

  emailInput.dispatchEvent(
    new InputEvent("relay-address", {
      data: relayAlias.address,
    })
  );
}


// COMPATIBILITY NOTE: browser.menus.getTargetElement is not available so 
// we have to listen for any contextmenu click to determe the target element.
// https://stackoverflow.com/a/7704392
let clickedEl = null;

// Only listen if on Chrome
if (!browser.menus) {
  document.addEventListener("contextmenu", function(event){
      clickedEl = event.target;
  }, true);
}

browser.runtime.onMessage.addListener((message, sender, response) => {

  if (message.type === "fillTargetWithRelayAddress") {    

    // COMPATIBILITY NOTE: getTargetElement() not available on Chrome contextMenus API
    const emailInput = browser.menus
          ? browser.menus.getTargetElement(message.targetElementId)
          : clickedEl
    return fillInputWithAlias(emailInput, message.relayAddress);
  }

  if (message.type === "showMaxNumAliasesMessage") {
    return showModal();
  }
});
