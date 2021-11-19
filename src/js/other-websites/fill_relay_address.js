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
  const { fxaSubscriptionsUrl } = await browser.storage.local.get(
    "fxaSubscriptionsUrl"
  );
  const { premiumProdId } = await browser.storage.local.get("premiumProdId");
  const { premiumPriceId } = await browser.storage.local.get("premiumPriceId");
  getUnlimitedAliasesBtn.href = `${fxaSubscriptionsUrl}/products/${premiumProdId}?plan=${premiumPriceId}`;

  const premiumEnabled = await browser.storage.local.get("premiumEnabled");
  const premiumEnabledString = premiumEnabled.premiumEnabled;

  if (premiumEnabledString === "True") {
    modalContent.appendChild(getUnlimitedAliasesBtn);
  }

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
  switch (relayAlias.domain) {
    case 1:
      emailInput.value = relayAlias.address + "@relay.firefox.com";
      break;
    case 2:
      emailInput.value = relayAlias.address + "@mozmail.com";
      break;
    default:
      break;
  }

  emailInput.dispatchEvent(
    new InputEvent("relay-address", {
      data: relayAlias.address,
    })
  );
}

browser.runtime.onMessage.addListener((message, sender, response) => {
  if (message.type === "fillTargetWithRelayAddress") {
    const emailInput = browser.menus.getTargetElement(message.targetElementId);
    return fillInputWithAlias(emailInput, message.relayAddress);
  }

  if (message.type === "showMaxNumAliasesMessage") {
    return showModal();
  }
});
