const RELAY_SITE_ORIGIN = "http://127.0.0.1:8000";

browser.storage.local.set({ "maxNumAliases": 5 });
browser.storage.local.set({ "relaySiteOrigin": RELAY_SITE_ORIGIN });


browser.runtime.onInstalled.addListener(async () => {
  const { firstRunShown } = await browser.storage.local.get("firstRunShown");
  if (firstRunShown) {
    return;
  }
  const userApiToken = await browser.storage.local.get("apiToken");
  const apiKeyInStorage = (userApiToken.hasOwnProperty("apiToken"));
  const url = browser.runtime.getURL("first-run.html");
  if (!apiKeyInStorage) {
    await browser.tabs.create({ url });
    browser.storage.local.set({ "firstRunShown" : true });
  }
});


// https://stackoverflow.com/a/2117523
function uuidv4() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}


async function getOrMakeGAUUID() {
  const { ga_uuid } = await browser.storage.local.get("ga_uuid");
  if (ga_uuid) {
    return ga_uuid;
  }
  const newGAUUID = uuidv4();
  await browser.storage.local.set({ "ga_uuid": newGAUUID });
  return newGAUUID;
}


async function sendMetricsEvent(eventData) {
  const doNotTrackIsEnabled = (navigator.doNotTrack === "1");
  const { dataCollection } = await browser.storage.local.get("dataCollection");

  if (!dataCollection) {
    browser.storage.local.set({ "dataCollection": "data-enabled" });
  }

  if (dataCollection !== "data-enabled" || doNotTrackIsEnabled) {
    return;
  }

  const ga_uuid = await getOrMakeGAUUID();
  const eventDataWithGAUUID = Object.assign({ga_uuid}, eventData);
  const sendMetricsEventUrl = `${RELAY_SITE_ORIGIN}/metrics-event`;
  fetch(sendMetricsEventUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(eventDataWithGAUUID),
  });
}


async function makeRelayAddress(domain=null) {
  const apiToken = await browser.storage.local.get("apiToken");

  if (!apiToken.apiToken) {

    browser.tabs.create({
      url: RELAY_SITE_ORIGIN,
    });
    return;
  }

  const newRelayAddressUrl = `${RELAY_SITE_ORIGIN}/emails/`;
  const newRelayAddressResponse = await fetch(newRelayAddressUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `api_token=${apiToken.apiToken}`
  });
  if (newRelayAddressResponse.status === 402) {
    // FIXME: can this just return newRelayAddressResponse ?
    return {status: 402};
  }
  let newRelayAddressJson = await newRelayAddressResponse.json();
  if (domain) {
    // TODO: Update the domain attribute to be "label"
    newRelayAddressJson.domain = domain;
    // Store the domain in which the alias was generated, separate from the label 
    newRelayAddressJson.siteOrigin = domain;
  }
  // TODO: put this into an updateLocalAddresses() function
  const localStorageRelayAddresses = await browser.storage.local.get("relayAddresses");
  const localRelayAddresses = (Object.keys(localStorageRelayAddresses).length === 0) ? {relayAddresses: []} : localStorageRelayAddresses;
  const updatedLocalRelayAddresses = localRelayAddresses.relayAddresses.concat([newRelayAddressJson]);
  browser.storage.local.set({relayAddresses: updatedLocalRelayAddresses});
  return newRelayAddressJson;
}

async function makeRelayAddressForTargetElement(info, tab) {
  const pageUrl = new URL(info.pageUrl);
  const newRelayAddress = await makeRelayAddress(pageUrl.hostname);

  if (newRelayAddress.status === 402) {
    browser.tabs.sendMessage(
      tab.id,
      {
        type: "showMaxNumAliasesMessage",
      });
    return;
  }

  browser.tabs.sendMessage(
      tab.id,
      {
        type: "fillTargetWithRelayAddress",
        targetElementId : info.targetElementId,
        relayAddress: newRelayAddress,
      },
      {
        frameId: info.frameId,
    },
  );
}

async function fillInAddressWithAliasId(info, tab) {
  // Trim the context menu id to get the alias reference ID
  const selectedAliasId = info.menuItemId.replace("fx-private-relay-use-existing-alias_", "");

  // Get stored alias data
  const { relayAddresses } = await browser.storage.local.get("relayAddresses");

  // Select the correct alias from the stored alias data
  const selectedAliasObject = relayAddresses.filter(obj => {
    return obj.id === selectedAliasId
  })

  // console.log({
  //   tabId: tab.id,
  //   targetElementId: info.targetElementId,
  //   relayAddress: selectedEmailAddress,
  //   frameId: info.frameId
  // });

  browser.tabs.sendMessage(
      tab.id,
      {
        type: "fillTargetWithRelayAddress",
        targetElementId : info.targetElementId,
        relayAddress: selectedAliasObject[0],
      },
      {
        frameId: info.frameId,
    },
  );

}

function addAliasToExistingAliasContextMenu(alias, parentId) {
  
  // If there's a label. Set the context menu item title accordingly.
  const title = (alias.domain ? alias.domain : alias.address);
  const id = "fx-private-relay-use-existing-alias_" + alias.id; 
  
  browser.menus.create({
    id,
    type: "radio",
    title,
    parentId,
  });
}

async function generateAliasesContextMenu(aliases, opts) {
  
  if ( opts?.siteOrigin ) {

    const parentSiteOriginId = "fx-private-relay-use-existing-aliases-from-this-site";

    browser.menus.create({
      id: parentSiteOriginId,
      title: "Use existing alias from this site…",
    });

    for (const alias of aliases) {
      addAliasToExistingAliasContextMenu(alias, parentSiteOriginId);
    }

    // WIP Code - If adding a separator.
    // browser.menus.create({
    //   id: parentSiteOriginId,
    //   type: "separator",
    //   title: "Use existing alias from this site…",
    // });

  } else {

    const parentNonSiteOriginId = "fx-private-relay-use-existing-aliases";

    // TODO: Set l10n for title
    browser.menus.create({
      id: parentNonSiteOriginId,
      title: "Use existing alias",
    });

    for (const alias of aliases) {
      addAliasToExistingAliasContextMenu(alias, parentNonSiteOriginId);
    }
  }
}

async function initExistingAliasContextMenu() {
  const { relayAddresses } = await browser.storage.local.get("relayAddresses");
  const selectableAddressesArray = [];
  const siteOriginAddressesArray = [];
  const nonSiteOriginAddressesArray = [];

  const sortableAddress = relayAddresses;

  // BUG: We need to query all aliases to see if any items siteOrigin attr 
  // match the current site, rather than looping over the first five items. 
  // This will change this forLoop dramatically.

  for (let index = 0; index < 5; index++) {
    const element = sortableAddress[index];

    // The ID (regardless of site origin) needs to be generated and stored during this first loop. 
    // The selectableAddressesArray is used to add the event listener to fillInAddressWithAliasId;
    const id = "fx-private-relay-use-existing-alias_" + element.id; 
    selectableAddressesArray.push(id);

    
    if (element.siteOrigin) {
      siteOriginAddressesArray.push(element);
    } else {
      nonSiteOriginAddressesArray.push(element);
    }   
  }

  // If there are aliases generated on the current site, add those first.
  if (siteOriginAddressesArray.length > 0) {
    generateAliasesContextMenu(siteOriginAddressesArray, {"siteOrigin": true});
  }

  // Add rest of the available aliases to the context menu
  if (nonSiteOriginAddressesArray.length > 0) {
    generateAliasesContextMenu(nonSiteOriginAddressesArray);
  }

  browser.menus.onClicked.addListener( async (info, tab) => {
    if ( selectableAddressesArray.includes(info.menuItemId) ) {
      await fillInAddressWithAliasId(info, tab);
    }
  });

}

if (browser.menus) {

  // TODO: Set enabled to false if max aliases reached on free tier 
  browser.menus.create({
    id: "fx-private-relay-generate-alias",
    title: "Generate New Alias",
    contexts: ["editable"]
  });

  initExistingAliasContextMenu();

  browser.menus.onClicked.addListener( async (info, tab) => {
    switch (info.menuItemId) {
      case "fx-private-relay-generate-alias":
        sendMetricsEvent({
          category: "Extension: Context Menu",
          action: "click",
          label: "context-menu-generate-alias"
        });
        await makeRelayAddressForTargetElement(info, tab);
        break;
    }
  });

  browser.menus.onShown.addListener( async (info, tab) => {
    switch (info.menuItemId) {
      case "fx-private-relay-use-existing-aliases":
        console.log("fx-private-relay-use-existing-aliases", info.contexts);
        break;
    }
  });

}

browser.runtime.onMessage.addListener(async (m) => {
  let response;

  switch (m.method) {
    case "makeRelayAddress":
      response = await makeRelayAddress(m.domain);
      break;
    case "updateInputIconPref":
      browser.storage.local.set({ "showInputIcons" : m.iconPref });
      break;
    case "openRelayHomepage":
      browser.tabs.create({
        url: `${RELAY_SITE_ORIGIN}?utm_source=fx-relay-addon&utm_medium=input-menu&utm_content=go-to-fx-relay`,
      });
      break;
    case "sendMetricsEvent":
      response = await sendMetricsEvent(m.eventData);
      break;
  }
  return response;
});
