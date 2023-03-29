const RELAY_SITE_ORIGIN = "http://127.0.0.1:8000";

browser.storage.local.set({ maxNumAliases: 5 });
browser.storage.local.set({ relaySiteOrigin: RELAY_SITE_ORIGIN });
browser.storage.local.set({ relayApiSource: `${RELAY_SITE_ORIGIN}/api/v1` });

browser.runtime.onInstalled.addListener(async (details) => {
  const { firstRunShown } = await browser.storage.local.get("firstRunShown");

  if (details.reason == "update") {
    // Force storeRuntimeData update
    await storeRuntimeData({forceUpdate: true});
  }
  
  
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

async function postReportWebcompatIssue(description) {
  const { relayApiSource } = await browser.storage.local.get("relayApiSource");  
  
  if (!relayApiSource) {
    return;
  }

  const headers = await createNewHeadersObject({auth: true});
  const reportWebCompatResponse = `${relayApiSource}/report_webcompat_issue`;

  const apiBody = {
    issue_on_domain: description.issue_on_domain,
    email_mask_not_accepted: description.email_mask_not_accepted,
    add_on_visual_issue: description.add_on_visual_issue,
    email_not_received: description.email_not_received,
    other_issue: description.other_issue,
    user_agent: description.user_agent
  };

  await fetch(reportWebCompatResponse, {
    mode: "same-origin",
    method: "POST",
    headers: headers,
    body: JSON.stringify(apiBody),
  });
}

async function storeRuntimeData(opts={forceUpdate: false}) {  
  const existingPremiumAvailability = (await browser.storage.local.get("periodicalPremiumPlans")).periodicalPremiumPlans;
  // If we already fetched Premium availability in the past seven days,
  // don't fetch it again.
  const checkingRemainingDays = Date.now() - 7 * 24 * 60 * 60 * 1000;
  if (typeof existingPremiumAvailability === "object" && 
      existingPremiumAvailability.fetchedAt > checkingRemainingDays &&
      !opts.forceUpdate
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
    },
    periodicalPremiumPlans: {
      PERIODICAL_PREMIUM_PLANS: runtimeData.PERIODICAL_PREMIUM_PLANS,
      fetchedAt: Date.now(),
    },
  })
}

async function getCurrentPage() {
  const [currentTab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });

  return currentTab;
}

async function getCurrentPageHostname() {
  const currentPage = await getCurrentPage();
  
  if (currentPage && currentPage.url) {
    const url = new URL(currentPage.url);
    return url.hostname;
  }

  // Not a valid URL (about:// or chrome:// internal page)
  return false;  
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
async function makeDomainAddress(address, block_list_emails, description = null) {
  const apiToken = await browser.storage.local.get("apiToken");

  if (!apiToken.apiToken) {
    browser.tabs.create({
      url: RELAY_SITE_ORIGIN,
    });
    return;
  }

  const { relayApiSource } = await browser.storage.local.get("relayApiSource");  
  const serverStoragePermission = await getServerStoragePref();
  const relayApiUrlRelayAddress = `${relayApiSource}/domainaddresses/`;

  let apiBody = {
    "enabled": true,
    "description": "",
    "block_list_emails": block_list_emails,
    "used_on": "",
    "address": address,
  };

  // Only send description/generated_for/used_on fields in the request if the user is opt'd into server storage
  if (description && serverStoragePermission) {
    apiBody.description = description;
    apiBody.generated_for = description;
    // The "," is appended here as this field is a comma-seperated list (but is a strict STRING type in the database). 
    // used_on lists all the different sites the add-on has populated a form field on for this mask
    // Because it contains multiple websites, we're using the CSV structure to explode/filter the string later
    apiBody.used_on = description + ",";
  }


  const headers = await createNewHeadersObject({auth: true});

  const newRelayAddressResponse = await fetch(relayApiUrlRelayAddress, {
    mode: "same-origin",
    method: "POST",
    headers: headers,
    body: JSON.stringify(apiBody),
  });

  // Error Code Context: 
  // 400: Word not allowed (See https://github.com/mozilla/fx-private-relay/blob/main/emails/badwords.text)
  // 402: Currently unknown. See FIXME in makeRelayAddress() function.
  // 409: Custom mask name already exists
  
  if ([402, 409, 400].includes(newRelayAddressResponse.status)) {
      return {status: newRelayAddressResponse.status};
  }

  let newRelayAddressJson = await newRelayAddressResponse.json();

  if (description) {
    newRelayAddressJson.description = description;
    // Store the domain in which the alias was generated, separate from the label
    newRelayAddressJson.generated_for = description;
  }

  // Save the new mask in local storage
  updateLocalStorageAddress(newRelayAddressJson);
 
  return newRelayAddressJson;
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
    // The "," is appended here as this field is a comma-seperated list (but is a strict STRING type in the database). 
    // used_on lists all the different sites the add-on has populated a form field on for this mask
    // Because it contains multiple websites, we're using the CSV structure to explode/filter the string later
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
    newRelayAddressJson.description = description;
    // Store the domain in which the alias was generated, separate from the label
    newRelayAddressJson.generated_for = description;
  }

  // Save the new mask in local storage
  updateLocalStorageAddress(newRelayAddressJson);
  
  return newRelayAddressJson;
}

async function updateLocalStorageAddress(newMaskJson) {
  const localStorageRelayAddresses = await browser.storage.local.get(
    "relayAddresses"
  );

  // This is a storage function to save the newly created mask in the users local storage.
  // We first confirm if there are addresses already saved, then add the new one to the list
  // After adding it to the list, we re-sort the list by date created, ordering the newst masks to be listed first
  const localRelayAddresses =
    Object.keys(localStorageRelayAddresses).length === 0
      ? { relayAddresses: [] }
      : localStorageRelayAddresses;
  const updatedLocalRelayAddresses = localRelayAddresses.relayAddresses.concat([
    newMaskJson,
  ]);

  updatedLocalRelayAddresses.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  
  await browser.storage.local.set({ relayAddresses: updatedLocalRelayAddresses });
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
    case "getCurrentPageHostname":
      // Only capture the page hostanme if the active tab is an non-internal (about:) page.
      response = await getCurrentPageHostname();
      break;
    case "makeDomainAddress":
      response = await makeDomainAddress(m.address, m.block_list_emails, m.description);
      break;
    case "makeRelayAddress":
      response = await makeRelayAddress(m.description);
      break;
    case "postReportWebcompatIssue":
      await postReportWebcompatIssue(m.description);
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