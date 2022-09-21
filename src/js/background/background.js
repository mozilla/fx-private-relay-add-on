const RELAY_SITE_ORIGIN = "http://127.0.0.1:8000";

browser.storage.local.set({ maxNumAliases: 5 });
browser.storage.local.set({ relaySiteOrigin: RELAY_SITE_ORIGIN });
browser.storage.local.set({ relayApiSource: `${RELAY_SITE_ORIGIN}/api/v1` });

browser.runtime.onInstalled.addListener(async (details) => {
  const { firstRunShown } = await browser.storage.local.get("firstRunShown");
  if (firstRunShown || details.reason !== "install") {
    return;
  }
  const userApiToken = await browser.storage.local.get("apiToken");
  const apiKeyInStorage = Object.prototype.hasOwnProperty.call(userApiToken, "apiToken");
  const url = browser.runtime.getURL("/first-run.html");
  if (!apiKeyInStorage) {
    await browser.tabs.create({ url });
    browser.storage.local.set({ firstRunShown: true });
  }
});

// This function is defined as global in the ESLint config _because_ it is created here:
// eslint-disable-next-line no-redeclare, no-unused-vars
async function getAliasesFromServer(method = "GET", opts=null) {
  const { relayApiSource } = await browser.storage.local.get("relayApiSource");  
  const relayApiUrlRelayAddresses = `${relayApiSource}/relayaddresses/`;
  const relayApiUrlDomainAddresses = `${relayApiSource}/domainaddresses/`;

  const headers = await createNewHeadersObject({auth: true});

  const response = await fetch(relayApiUrlRelayAddresses, {
    mode: "same-origin",
    method,
    headers: headers,
  });

  const answer = await response.json();
  const masks = new Array();
  masks.push(...answer);

  // If the user has domain (custom) masks set, also grab them before sorting
  if (opts.fetchCustomMasks) {
    const domainResponse = await fetch(relayApiUrlDomainAddresses, {
      mode: "same-origin",
      method,
      headers: headers,
    });

    const domainMasks = await domainResponse.json();
    masks.push(...domainMasks);
  }
  
  masks.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  browser.storage.local.set({ relayAddresses: masks });  
  return masks;
}

// This function is defined as global in the ESLint config _because_ it is created here:
// eslint-disable-next-line no-redeclare, no-unused-vars
async function patchMaskInfo(method = "PATCH", id, data, opts=null) {

  const { relayApiSource } = await browser.storage.local.get("relayApiSource");  
  const relayApiUrlRelayAddressId = `${relayApiSource}/relayaddresses/${id}/`;
  const relayApiUrlPatchAddressId = `${relayApiSource}/domainaddresses/${id}/`;

  const csrfCookieValue = await browser.storage.local.get("csrfCookieValue");
  const headers = new Headers();
  
  headers.set("X-CSRFToken", csrfCookieValue);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  
  if (opts && opts.auth) {
    const apiToken = await browser.storage.local.get("apiToken");
    headers.set("Authorization", `Token ${apiToken.apiToken}`);
  }

  // Check which type of mask this is: Custom or Random
  const apiRequestUrl = opts.mask_type === "custom" ? relayApiUrlPatchAddressId : relayApiUrlRelayAddressId;

  const response = await fetch(apiRequestUrl, {
    mode: "same-origin",
    method,
    headers: headers,
    body: JSON.stringify(data),
  });

  return await response.json();
}

async function storeRuntimeData() {
  // If we already fetched Premium availability in the past seven days,
  // don't fetch it again.
  const existingPremiumAvailability = (await browser.storage.local.get("premiumCountries")).premiumCountries;
  const existingIntroPricingEndDate = (await browser.storage.local.get("introPricingEndDate")).introPricingEndDate;
  
  // If we already fetched Premium availability in the past seven days,
  // don't fetch it again.
  const checkingRemainingDays = Date.now() - 7 * 24 * 60 * 60 * 1000;
  if (typeof existingPremiumAvailability === "object" && 
      typeof existingIntroPricingEndDate === "object" && 
      existingPremiumAvailability.fetchedAt > checkingRemainingDays &&
      existingIntroPricingEndDate.fetchedAt > checkingRemainingDays
      ) 
      {
    return;
  }

  const { relayApiSource } = await browser.storage.local.get("relayApiSource");
  if (!relayApiSource) {
    return;
  }
  const runtimeDataResponse = await fetch(
    `${relayApiSource}/runtime_data`,
    {
      headers: { Accept: "application/json" },
    },
  );
  const runtimeData = await runtimeDataResponse.json();
  
  browser.storage.local.set({
    premiumCountries: {
      PREMIUM_PLANS: runtimeData.PREMIUM_PLANS,
      fetchedAt: Date.now(),
    },
    waffleFlags: {
      WAFFLE_FLAGS: runtimeData.WAFFLE_FLAGS,
      fetchedAt: Date.now(),
    },
    bundlePlans: {
      BUNDLE_PLANS: runtimeData.BUNDLE_PLANS,
      fetchedAt: Date.now(),
    },
    phonePlans: {
      PHONE_PLANS: runtimeData.PHONE_PLANS,
      fetchedAt: Date.now(),
    }
  })
}

async function getCurrentPage() {
  const [currentTab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });

  return currentTab;
}

// This function is defined as global in the ESLint config _because_ it is created here:
// eslint-disable-next-line no-redeclare
async function getServerStoragePref() {
  const { profileID } = await browser.storage.local.get("profileID");
  const headers = await createNewHeadersObject({ auth: true });
  const { relayApiSource } = await browser.storage.local.get("relayApiSource");
  const relayApiUrlProfilesId = `${relayApiSource}/profiles/${profileID}/`;

  const response = await fetch(relayApiUrlProfilesId, {
    mode: "same-origin",
    method: "GET",
    headers: headers,
  });

  const answer = await response.json();

  browser.storage.local.set({ server_storage: answer.server_storage });

  return answer.server_storage;
}

// https://stackoverflow.com/a/2117523
function uuidv4() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (
      c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
    ).toString(16)
  );
}

async function getOrMakeGAUUID() {
  const { ga_uuid } = await browser.storage.local.get("ga_uuid");
  if (ga_uuid) {
    return ga_uuid;
  }
  const newGAUUID = uuidv4();
  await browser.storage.local.set({ ga_uuid: newGAUUID });
  return newGAUUID;
}

// This function is defined as global in the ESLint config _because_ it is created here:
// eslint-disable-next-line no-redeclare
async function sendMetricsEvent(eventData) {
  const doNotTrackIsEnabled = navigator.doNotTrack === "1";
  const { dataCollection } = await browser.storage.local.get("dataCollection");

  if (!dataCollection) {
    browser.storage.local.set({ dataCollection: "data-enabled" });
  }

  if (dataCollection !== "data-enabled" || doNotTrackIsEnabled) {
    return;
  }

  const ga_uuid = await getOrMakeGAUUID();
  const eventDataWithGAUUID = Object.assign({ ga_uuid }, eventData);
  const sendMetricsEventUrl = `${RELAY_SITE_ORIGIN}/metrics-event`;
  fetch(sendMetricsEventUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventDataWithGAUUID),
  });
}

async function createNewHeadersObject(opts) {
  const headers = new Headers();
  const { csrfCookieValue } = await browser.storage.local.get(
    "csrfCookieValue"
  );

  headers.set("X-CSRFToken", csrfCookieValue);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");

  if (opts && opts.auth) {
    const apiToken = await browser.storage.local.get("apiToken");
    headers.set("Authorization", `Token ${apiToken.apiToken}`);
  }

  return headers;
}

async function refreshAccountPages() {
  browser.tabs.query({url: "http://127.0.0.1/*"}).then(tabs => {
    for (let tab of tabs) {
      const tabUrl = new URL(tab.url);
      if (tabUrl.pathname.startsWith("/accounts/settings")) {
        continue;
      }
      browser.tabs.reload(tab.id);
    }
  });
}

// This function is defined as global in the ESLint config _because_ it is created here:
// eslint-disable-next-line no-redeclare
async function makeRelayAddress(description = null) {
  const apiToken = await browser.storage.local.get("apiToken");

  if (!apiToken.apiToken) {
    browser.tabs.create({
      url: RELAY_SITE_ORIGIN,
    });
    return;
  }

  const { relayApiSource } = await browser.storage.local.get("relayApiSource");  
  const serverStoragePermission = await getServerStoragePref();
  const relayApiUrlRelayAddress = `${relayApiSource}/relayaddresses/`;

  let apiBody = {
    enabled: true,
    description: "",
    generated_for: "",
    used_on: "",
  };

  // Only send description/generated_for/used_on fields in the request if the user is opt'd into server storage
  if (description && serverStoragePermission) {
    apiBody.description = description;
    apiBody.generated_for = description;
    apiBody.used_on = description + ",";
  }

  const headers = await createNewHeadersObject({auth: true});

  const newRelayAddressResponse = await fetch(relayApiUrlRelayAddress, {
    mode: "same-origin",
    method: "POST",
    headers: headers,
    body: JSON.stringify(apiBody),
  });

  if (newRelayAddressResponse.status === 402) {
    // FIXME: can this just return newRelayAddressResponse ?
    return { status: 402 };
  }

  let newRelayAddressJson = await newRelayAddressResponse.json();

  if (description) {
    // TODO: Update the domain attribute to be "label"
    newRelayAddressJson.description = description;
    // Store the domain in which the alias was generated, separate from the label
    newRelayAddressJson.generated_for = description;
  }

  // TODO: put this into an updateLocalAddresses() function
  const localStorageRelayAddresses = await browser.storage.local.get(
    "relayAddresses"
  );
  const localRelayAddresses =
    Object.keys(localStorageRelayAddresses).length === 0
      ? { relayAddresses: [] }
      : localStorageRelayAddresses;
  const updatedLocalRelayAddresses = localRelayAddresses.relayAddresses.concat([
    newRelayAddressJson,
  ]);

  updatedLocalRelayAddresses.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  
  browser.storage.local.set({ relayAddresses: updatedLocalRelayAddresses });
  return newRelayAddressJson;
}

async function updateAddOnAuthStatus(status) {
  // If user is no longer logged in, remove the apiToken attribute. 
  // This will cause the "Sign in" panel to be visible when the popup is opened.
  if (status === false) {
    await browser.storage.local.remove("apiToken");
  }
}

async function displayBrowserActionBadge() {
  const userApiToken = await browser.storage.local.get("apiToken");
  const apiKeyInStorage = Object.prototype.hasOwnProperty.call(userApiToken, "apiToken");
  if (!apiKeyInStorage) {
    // Not Logged In
    return;
  }

  // Logged In User
  const { browserActionBadgesClicked } = await browser.storage.local.get(
    "browserActionBadgesClicked"
  );

  const { privacyNoticeUpdatePromptShown } = await browser.storage.local.get(
    "privacyNoticeUpdatePromptShown"
  );
  const { serverStoragePrompt } = await browser.storage.local.get(
    "serverStoragePrompt"
  );

  if (browserActionBadgesClicked === undefined) {
    browser.storage.local.set({ browserActionBadgesClicked: false });
  }

  if (!browserActionBadgesClicked && (serverStoragePrompt !== true || privacyNoticeUpdatePromptShown !== true)) {
    browser.browserAction.setBadgeBackgroundColor({
      color: "#00D900",
    });
    browser.browserAction.setBadgeText({ text: "!" });
  }
}

browser.runtime.onMessage.addListener(async (m, sender, _sendResponse) => {
  let response;
  const currentPage = await getCurrentPage();
  const url = new URL(currentPage.url);

  switch (m.method) {
    case "displayBrowserActionBadge":
      await displayBrowserActionBadge();
      break;
    case "iframeCloseRelayInPageMenu":
      browser.tabs.sendMessage(sender.tab.id, {message: "iframeCloseRelayInPageMenu"});
      break;
    case "fillInputWithAlias":
      browser.tabs.sendMessage(sender.tab.id, m.message);
      break;
    case "updateIframeHeight":
      browser.tabs.sendMessage(sender.tab.id, m);
      break;
    case "getServerStoragePref":
      response = await getServerStoragePref();
      break;
    case "getAliasesFromServer":
      response = await getAliasesFromServer("GET", m.options);
      break;
    case "patchMaskInfo":
      await patchMaskInfo("PATCH", m.id, m.data, m.options);
      break;
    case "getCurrentPage":
      response = await getCurrentPage();
      break;
    case "getCurrentPageHostname":
      response = url.hostname;
      break;
    case "makeRelayAddress":
      response = await makeRelayAddress(m.description);
      break;
    case "openRelayHomepage":
      browser.tabs.create({
        url: `${RELAY_SITE_ORIGIN}?utm_source=fx-relay-addon&utm_medium=input-menu&utm_content=go-to-fx-relay`,
      });
      break;
    case "rebuildContextMenuUpgrade":
      await relayContextMenus.init();
      break;
    case "refreshAccountPages":
      await refreshAccountPages();
      break;
    case "sendMetricsEvent":
      response = await sendMetricsEvent(m.eventData);
      break;
    case "updateAddOnAuthStatus":
      await updateAddOnAuthStatus(m.status);
      break;
    case "updateInputIconPref":
      browser.storage.local.set({ showInputIcons: m.iconPref });
      break;
  }
  return response;
});


(async () => {
  await displayBrowserActionBadge();
  await storeRuntimeData();
})();