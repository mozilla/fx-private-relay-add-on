const RELAY_SITE_ORIGIN = "http://127.0.0.1:8000";

browser.storage.local.set({ maxNumAliases: 5 });
browser.storage.local.set({ relaySiteOrigin: RELAY_SITE_ORIGIN });
browser.storage.local.set({ relayApiSource: `${RELAY_SITE_ORIGIN}/api/v1` });

browser.runtime.onInstalled.addListener(async () => {
  const { firstRunShown } = await browser.storage.local.get("firstRunShown");
  if (firstRunShown) {
    return;
  }
  const userApiToken = await browser.storage.local.get("apiToken");
  const apiKeyInStorage = userApiToken.hasOwnProperty("apiToken");
  const url = browser.runtime.getURL("/first-run.html");
  if (!apiKeyInStorage) {
    await browser.tabs.create({ url });
    browser.storage.local.set({ firstRunShown: true });
  }
});

async function getAliasesFromServer(method = "GET", body = null, opts=null) {
  const { relayApiSource } = await browser.storage.local.get("relayApiSource");  
  const apiMakeRelayAddressesURL = `${relayApiSource}/relayaddresses/`;

  const csrfCookieValue = await browser.storage.local.get("csrfCookieValue");
  const headers = new Headers();
  
  headers.set("X-CSRFToken", csrfCookieValue);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  
  if (opts && opts.auth) {
    const apiToken = await browser.storage.local.get("apiToken");
    headers.set("Authorization", `Token ${apiToken.apiToken}`);
  }

  const response = await fetch(apiMakeRelayAddressesURL, {
    mode: "same-origin",
    method,
    headers: headers,
    body,
  });

  answer = await response.json();
  
  return answer;
}

async function storePremiumAvailabilityInCountry() {
  // If we already fetched Premium availability in the past seven days,
  // don't fetch it again.
  const existingPremiumAvailability = (await browser.storage.local.get("premiumCountries"))?.premiumCountries;
  if (typeof existingPremiumAvailability === "object" && existingPremiumAvailability.fetchedAt > (Date.now() - 7 * 24 * 60 * 60 * 1000)) {
    return;
  }

  const { relayApiSource } = await browser.storage.local.get("relayApiSource");
  if (!relayApiSource) {
    return;
  }
  const currentPremiumAvailabilityResponse = await fetch(
    `${relayApiSource}/premium_countries`,
    {
      headers: { Accept: "application/json" },
    },
  );
  const currentPremiumAvailability = await currentPremiumAvailabilityResponse.json();
  browser.storage.local.set({
    premiumCountries: {
      ...currentPremiumAvailability,
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

async function getServerStoragePref() {
  const { profileID } = await browser.storage.local.get("profileID");
  const headers = await createNewHeadersObject({ auth: true });
  const { relayApiSource } = await browser.storage.local.get("relayApiSource");
  const url = `${relayApiSource}/profiles/${profileID}/`;

  const response = await fetch(url, {
    mode: "same-origin",
    method: "GET",
    headers: headers,
  });

  answer = await response.json();

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
  const { settingsRefresh } = await browser.storage.local.get(
    "settingsRefresh"
  );

  // This functions only runs once (when on the dashboard page), if the user has visited the settings page.
  // If they revisit the settings page, it resets so that it only runs once again.
  if (!settingsRefresh) {
    browser.storage.local.set({ settingsRefresh: true });

    function tabReloader(tabs) {
      for (let tab of tabs) {
        browser.tabs.reload(tab.id);
      }
    };

    browser.tabs.query({url: "http://127.0.0.1/*"}).then(tabReloader);   
  }
}

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
  const apiMakeRelayAddressesURL = `${relayApiSource}/relayaddresses/`;
  const newRelayAddressUrl = apiMakeRelayAddressesURL;

  let apiBody = {
    enabled: true,
    description: "",
    generated_for: "",
  };

  // Only send description/generated_for fields in the request if the user is opt'd into server storage
  if (description && serverStoragePermission) {
    apiBody.description = description;
    apiBody.generated_for = description;
  }

  const headers = await createNewHeadersObject({auth: true});

  const newRelayAddressResponse = await fetch(newRelayAddressUrl, {
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
  browser.storage.local.set({ relayAddresses: updatedLocalRelayAddresses });

  await refreshAccountPages();

  return newRelayAddressJson;
}

async function updateAddOnAuthStatus(status) {
  // If user is no longer logged in, remove the apiToken attribute. 
  // This will cause the "Sign in" panel to be visible when the popup is opened.
  if (status === "False") {
    await browser.storage.local.remove("apiToken");
  }
}

async function displayBrowserActionBadge() {
  const userApiToken = await browser.storage.local.get("apiToken");
  const apiKeyInStorage = userApiToken.hasOwnProperty("apiToken");
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

browser.runtime.onMessage.addListener(async (m, sender, sendResponse) => {
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
    case "getCurrentPageHostname":
      const currentPage = await getCurrentPage();
      const url = new URL(currentPage.url);
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
  await storePremiumAvailabilityInCountry();
})();