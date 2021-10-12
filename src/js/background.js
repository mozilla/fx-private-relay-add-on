const RELAY_SITE_ORIGIN = "http://127.0.0.1:8000";
const ADDON_VERSION = "1.7.1";
//
browser.storage.local.set({ addOnVersion: null });
browser.storage.local.set({ maxNumAliases: 5 });
browser.storage.local.set({ relaySiteOrigin: RELAY_SITE_ORIGIN });
browser.storage.local.set({ relayApiSource: `${RELAY_SITE_ORIGIN}/api/v1` });

browser.runtime.onInstalled.addListener(async () => {
  await runDataMigrationCheck();

  const { firstRunShown } = await browser.storage.local.get("firstRunShown");
  if (firstRunShown) {
    return;
  }
  const userApiToken = await browser.storage.local.get("apiToken");
  const apiKeyInStorage = userApiToken.hasOwnProperty("apiToken");
  const url = browser.runtime.getURL("first-run.html");
  if (!apiKeyInStorage) {
    await browser.tabs.create({ url });
    browser.storage.local.set({ firstRunShown: true });
  }
});

// async function labelDataMigration() {

//   const { dataMigrationCompleted } = await browser.storage.local.get(
//     "dataMigrationCompleted"
//   );

//   if (dataMigrationCompleted == true) {
//     return;
//   }

//   browser.storage.local.set({ dataMigrationCompleted: false });
// }

async function runDataMigrationCheck() {
  const { addOnVersion } = await browser.storage.local.get("addOnVersion");

  if (!addOnVersion) {
    // console.log("No previous data version");
    browser.storage.local.set({ addOnVersion: ADDON_VERSION });
    // await labelDataMigration();
  }

  switch (addOnVersion) {
    case "1.7.1":
      // await labelDataMigration();
      break;
  }
}

// https://stackoverflow.com/a/6832706
function compareVersion(a, b) {
  if (a === b) {
    return 0;
  }

  var a_components = a.split(".");
  var b_components = b.split(".");

  var len = Math.min(a_components.length, b_components.length);

  // loop while the components are equal
  for (var i = 0; i < len; i++) {
    // A bigger than B
    if (parseInt(a_components[i]) > parseInt(b_components[i])) {
      return 1;
    }

    // B bigger than A
    if (parseInt(a_components[i]) < parseInt(b_components[i])) {
      return -1;
    }
  }

  // If one's a prefix of the other, the longer one is greater.
  if (a_components.length > b_components.length) {
    return 1;
  }

  if (a_components.length < b_components.length) {
    return -1;
  }

  // Otherwise they are the same.
  return 0;
}

async function updateServerStoragePref(pref) {
  const { profileID } = await browser.storage.local.get("profileID");
  const { csrfCookieValue } = await browser.storage.local.get(
    "csrfCookieValue"
  );
  const headers = new Headers(undefined);

  headers.set("X-CSRFToken", csrfCookieValue);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");

  const settings = {
    server_storage: pref,
  };

  const { relayApiSource } = await browser.storage.local.get("relayApiSource");
  const url = `${relayApiSource}/profiles/${profileID}/`;

  const response = await fetch(url, {
    mode: "same-origin",
    method: "PATCH",
    body: JSON.stringify(settings),
    headers: headers,
  });

  if (response.ok) {
    // Refresh any open profile pages (/accounts/settings or /accounts/profile)
    browser.tabs.query({ url: "*://127.0.0.1/*" }, function (tabs) {
      for (let tab of tabs) {
        browser.tabs.sendMessage(tab.id, { message: "refreshSettingsPage" });
      }
    });
  }
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

async function makeRelayAddress(description = null) {
  const apiToken = await browser.storage.local.get("apiToken");

  if (!apiToken.apiToken) {
    browser.tabs.create({
      url: RELAY_SITE_ORIGIN,
    });
    return;
  }

  const { relayApiSource } = await browser.storage.local.get("relayApiSource");
  const { csrfCookieValue } = await browser.storage.local.get(
    "csrfCookieValue"
  );
  // const { apiToken } = await browser.storage.local.get("apiToken");

  const apiMakeRelayAddressesURL = `${relayApiSource}/relayaddresses/`;

  const newRelayAddressUrl = apiMakeRelayAddressesURL;

  let apiBody = {};

  if (description) {
    apiBody = JSON.stringify({
      enabled: true,
      description: description,
      generated_for: description,
    });
  }

  const headers = new Headers(undefined);

  headers.set("X-CSRFToken", csrfCookieValue);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Token ${apiToken.apiToken}`);

  const newRelayAddressResponse = await fetch(newRelayAddressUrl, {
    mode: "same-origin",
    method: "POST",
    headers: headers,
    body: apiBody,
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
    newRelayAddressJson.siteOrigin = description;
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
  return newRelayAddressJson;
}

async function makeRelayAddressForTargetElement(info, tab) {
  const pageUrl = new URL(info.pageUrl);
  const newRelayAddress = await makeRelayAddress(pageUrl.hostname);

  if (newRelayAddress.status === 402) {
    browser.tabs.sendMessage(tab.id, {
      type: "showMaxNumAliasesMessage",
    });
    return;
  }

  browser.tabs.sendMessage(
    tab.id,
    {
      type: "fillTargetWithRelayAddress",
      targetElementId: info.targetElementId,
      relayAddress: newRelayAddress,
    },
    {
      frameId: info.frameId,
    }
  );
}

function premiumFeaturesAvailable(premiumEnabledString) {
  return premiumEnabledString === "True";
}

async function createMenu() {
  if (browser.menus) {
    browser.menus.create({
      id: "fx-private-relay-generate-alias",
      title: "Generate New Alias",
      contexts: ["editable"],
    });
  }
}

createMenu();

async function createUpgradeContextMenuItem() {
  browser.menus.create({
    id: "fx-private-relay-get-unlimited-aliases",
    title: "Get Unlimited Aliases",
  });
}

async function removeUpgradeContextMenuItem() {
  browser.menus.remove("fx-private-relay-get-unlimited-aliases");
}

async function updateUpgradeContextMenuItem() {
  // Check for status
  // Update
  const premiumEnabled = await browser.storage.local.get("premiumEnabled");
  const premiumEnabledString = premiumEnabled.premiumEnabled;
  const { premium } = await browser.storage.local.get("premium");

  if (premiumFeaturesAvailable(premiumEnabledString)) {
    if (!premium) {
      // await createUpgradeContextMenuItem();
    }

    // Remove the upgrade item, if the user is upgraded
    else {
      // await removeUpgradeContextMenuItem();
    }
  }
}

browser.menus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case "fx-private-relay-generate-alias":
      sendMetricsEvent({
        category: "Extension: Context Menu",
        action: "click",
        label: "context-menu-generate-alias",
      });
      await makeRelayAddressForTargetElement(info, tab);
      break;
    case "fx-private-relay-get-unlimited-aliases":
      sendMetricsEvent({
        category: "Extension: Context Menu",
        action: "click",
        label: "context-menu-get-unlimited-aliases",
      });
      const { fxaSubscriptionsUrl, premiumProdId, premiumPriceId } =
        await browser.storage.local.get([
          "fxaSubscriptionsUrl",
          "premiumProdId",
          "premiumPriceId",
        ]);
      const urlPremium = `${fxaSubscriptionsUrl}/products/${premiumProdId}?plan=${premiumPriceId}`;
      await browser.tabs.create({ url: urlPremium });
      break;
  }
});

browser.runtime.onMessage.addListener(async (m) => {
  let response;

  switch (m.method) {
    case "makeRelayAddress":
      response = await makeRelayAddress(m.description);
      break;
    case "updateInputIconPref":
      browser.storage.local.set({ showInputIcons: m.iconPref });
      break;
    case "openRelayHomepage":
      browser.tabs.create({
        url: `${RELAY_SITE_ORIGIN}?utm_source=fx-relay-addon&utm_medium=input-menu&utm_content=go-to-fx-relay`,
      });
      break;
    case "sendMetricsEvent":
      response = await sendMetricsEvent(m.eventData);
      break;
    case "rebuildContextMenuUpgrade":
      await updateUpgradeContextMenuItem();
      break;
    case "updateServerStoragePref":
      await updateServerStoragePref(m.pref);
      break;
  }
  return response;
});
