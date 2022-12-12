

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

closeBtn.addEventListener("click", iframeCloseRelayInPageModal);
// Set Listeners
document.addEventListener("keydown", handleKeydownEvents);

const sendInPageEvent = (evtAction, evtLabel) => {
  sendRelayEvent("In-page", evtAction, evtLabel);
};

const generateAliasBtn = document.querySelector(".js-fx-relay-generate-mask");


async function currentPageURL() {
 const current = await browser.runtime.sendMessage({
    method: "getCurrentPageURL",
  });
  return current;
}

async function currentURL() {
  const current = await currentPageURL(); 

  if (current.includes("signin") || current.includes("login")) {
    console.log("this is a sign in process");
  }
  else {
    console.log("this is NOT a sign in process");
  }
}

currentURL();

async function getRemainingMasks() {
  const masks = await getMasks();
  const { maxNumAliases }  = await browser.storage.local.get(
    "maxNumAliases"
  );
  const numAliasesRemaining = maxNumAliases - masks.length;
  return numAliasesRemaining;
}

const masksLeftElem = document.querySelector(".masks-left");

const showMasksLeft = async () => {
  masksLeftElem.textContent = await getRemainingMasks();
}

showMasksLeft();

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
  console.log("clicked generate btn");

  // generateAliasBtn.classList.add("is-loading");

  // Request the active tab from the background script and parse the `document.location.hostname`
  const currentPageHostName = await browser.runtime.sendMessage({
    method: "getCurrentPageHostname",
  });

  const currentPageHostNameURL = await browser.runtime.sendMessage({
    method: "getCurrentPageURL",
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

});