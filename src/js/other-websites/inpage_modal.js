

async function iframeCloseRelayInPageModal() {
    document.removeEventListener("keydown", handleKeydownEvents);
    await browser.runtime.sendMessage({ method: "iframeCloseRelayInPageModal" });
  }


const closeBtn = document.querySelector(".js-close-modal");

async function handleKeydownEvents(e) {
  if (e.key === "Escape") {
    console.log("keydown escape");
    preventDefaultBehavior(e);
    await iframeCloseRelayInPageModal();
  }
}

closeBtn.addEventListener("click", iframeCloseRelayInPageModal);
// Set Listeners
document.addEventListener("keydown", handleKeydownEvents);

const sendInPageEvent = (evtAction, evtLabel) => {
  sendRelayEvent("In-page", evtAction, evtLabel);
};

const generateAliasBtn = document.querySelector(".js-fx-relay-generate-mask");
// console.log(generateAliasBtn);

// Handle "Generate New Alias" clicks
generateAliasBtn.addEventListener("click", async (generateClickEvt) => {
  sendInPageEvent("click", "input-modal-reuse-previous-alias");
  preventDefaultBehavior(generateClickEvt);
  console.log("clicked generate btn");

  // generateAliasBtn.classList.add("is-loading");

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
  // if (newRelayAddressResponse.status === 402) {
  //   generateClickEvt.target.classList.remove("is-loading");
  //   throw new Error(
  //     browser.i18n.getMessage("pageInputIconMaxAliasesError_mask")
  //   );
  // }

  const fillinput = await browser.runtime.sendMessage({
    method: "fillInputWithAlias",
    message: {
      filter: "fillInputWithAlias",
      newRelayAddressResponse,
    },
  });

});