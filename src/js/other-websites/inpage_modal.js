

async function iframeCloseRelayInPageModal() {
    document.removeEventListener("keydown", handleKeydownEvents);
    await browser.runtime.sendMessage({ method: "iframeCloseRelayInPageModal" });
  }

function getModalStrings() {

  return {
    "iteration_one": {
      "headline": "Are you sure you want to share your real email?",
      "body": "Use your email mask to protect your real identity and control how this company can contact you",
    },
    "iteration_two": {
      "headline": "Now’s the perfect time to protect your real email",
      "body": "Use your email mask to protect your real identity and control how this site can contact you.",
    },
    "iteration_three": {
      "headline": "Protect your real email address",
      "body": "Use your email mask to protect your real identity and control how this site can contact you.",
    },
    "iteration_four": {
      "headline": "Don’t share your email with this site",
      "body": "Use your email masks to protect your real identity and control how this site can contact you.",
    },
    "iteration_five": {
      "headline": "Don’t share your email – use a mask instead",
      "body": "Protect your real identity and control how this site can contact you in the future.",
    },
  }
}

const iterationArray = Object.values(getModalStrings());
const getRandomIterationFromArray = iterationArray[Math.floor(Math.random()*iterationArray.length)];

const modalHeadlineElem = document.querySelector(".fx-relay-modal .headline");
const modalBodyElem = document.querySelector(".fx-relay-modal .body");

modalHeadlineElem.textContent = getRandomIterationFromArray.headline;
modalBodyElem.textContent = getRandomIterationFromArray.body;

const closeBtn = document.querySelector(".js-close-modal");

async function handleKeydownEvents(e) {
  if (e.key === "Escape") {
    console.log("keydown escape");
    preventDefaultBehavior(e);
    await iframeCloseRelayInPageModal();
  }
}

closeBtn.addEventListener("click", async () => {
  await iframeCloseRelayInPageModal();
  

});

// Set Listeners
document.addEventListener("keydown", handleKeydownEvents);

const sendInPageEvent = (evtAction, evtLabel) => {
  sendRelayEvent("In-page", evtAction, evtLabel);
};

const generateAliasBtn = document.querySelector(".js-fx-relay-generate-mask");
 
async function getRemainingMasks(value) {
  const masks = await getMasks();
  let upgradeNeeded = false;
  const { maxNumAliases }  = await browser.storage.local.get(
    "maxNumAliases"
  );
  const numAliasesRemaining = maxNumAliases - masks.length;
  
  if (numAliasesRemaining === 0) {
    upgradeNeeded = true;
  }

  if (value === "num-remaining") {
    return numAliasesRemaining;
  }
  if (value === "check-upgrade") {
    return upgradeNeeded;
  }
}
const masksLeftElem = document.querySelector(".masks-left");

const showMasksLeft = async () => {
  masksLeftElem.textContent = await getRemainingMasks("num-remaining");
}

async function switchToUpgradeFooter(){
  const generateMaskModalFooter = document.querySelector(".js-generate-mask-modal-footer");
  const upgradeModalFooter = document.querySelector(".js-upgrade-modal-footer");

  if (await getRemainingMasks("check-upgrade")) {
    upgradeModalFooter.classList.remove("hidden");
    generateMaskModalFooter.classList.add("hidden");
  }
}

async function addLinks() {
  const { relaySiteOrigin } = await browser.storage.local.get(
    "relaySiteOrigin"
  );
  const premiumCountryAvailability = (await browser.storage.local.get("periodicalPremiumPlans")).periodicalPremiumPlans?.PERIODICAL_PREMIUM_PLANS

  const getUnlimitedMasksLink = document.querySelector(".js-get-unlimited-masks");
  const manageMasksLink = document.querySelector(".js-manage-masks");

  const unlimitedHref =
  premiumCountryAvailability?.available_in_country
    ? `${relaySiteOrigin}/premium?utm_source=fx-relay-addon&utm_medium=input-menu&utm_content=get-premium-link`
    : `${relaySiteOrigin}/premium?utm_source=fx-relay-addon&utm_medium=input-menu&utm_content=join-waitlist-link`;

  console.log(unlimitedHref);
  console.log(getUnlimitedMasksLink);

  manageMasksLink.href = `${relaySiteOrigin}?utm_source=fx-relay-addon&utm_medium=input-menu&utm_content=manage-all-addresses`;
  manageMasksLink.target = "_blank";
  getUnlimitedMasksLink.href = unlimitedHref;
  getUnlimitedMasksLink.target = "_blank";

}

showMasksLeft();
switchToUpgradeFooter();
addLinks();

const generateMaskModalFooter = document.querySelector(".js-generate-mask-modal-footer");
const upgradeModalFooter = document.querySelector(".js-upgrade-modal-footer");

// const masksremaning = await getRemainingMasks();
// console.log(masksremaning);

async function getCachedServerStoragePref() {
  const serverStoragePref = await browser.storage.local.get("server_storage");
  const serverStoragePrefInLocalStorage = Object.prototype.hasOwnProperty.call(
    serverStoragePref,
    "server_storage"
  );

  if (!serverStoragePrefInLocalStorage) {
    // There is no reference to the users storage preference saved. Fetch it from the server.
    return await browser.runtime.sendMessage({
      method: "getServerStoragePref",
    });
  } else {
    // If the stored pref exists, return value
    return serverStoragePref.server_storage;
  }
}

async function getMasks(options = { fetchCustomMasks: false }) {
  const serverStoragePref = await getCachedServerStoragePref();

  if (serverStoragePref) {
    try {
      return await browser.runtime.sendMessage({
        method: "getAliasesFromServer",
        options,
      });
    } catch (error) {
      console.warn(`getAliasesFromServer Error: ${error}`);

      // API Error — Fallback to local storage
      const { relayAddresses } = await browser.storage.local.get(
        "relayAddresses"
      );

      return relayAddresses;
    }
  }

  const { relayAddresses } = await browser.storage.local.get("relayAddresses");
  return relayAddresses;
}


// Handle "Generate New Alias" clicks
generateAliasBtn.addEventListener("click", async (generateClickEvt) => {
  sendInPageEvent("click", "input-modal-reuse-previous-alias");
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

  // Catch edge cases where the "Generate New Alias" button is still enabled,
  // but the user has already reached the max number of aliases.
  // if (newRelayAddressResponse.status === 402) {
  //   generateClickEvt.target.classList.remove("is-loading");
  //   throw new Error(
  //     browser.i18n.getMessage("pageInputIconMaxAliasesError_mask")
  //   );
  // }

  await browser.runtime.sendMessage({
    method: "fillInputWithAlias",
    message: {
      filter: "fillInputWithAlias",
      newRelayAddressResponse,
    },
  });

  await browser.runtime.sendMessage({ method: "iframeCloseRelayInPageModal" });
  await iframeCloseRelayInPageModal();

});

