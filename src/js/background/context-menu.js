// TODO: Move all functions in this page into relayContextMenus() function

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

function onContextMenuCreated() {
  // Catch errors when trying to create the same menu twice.
  // The browser.menus API is limited. You cannot query if a menu item already exists.
  // The error it throws does not show up to the user.

  if (browser.runtime.lastError) {
    return;
  }
}

async function fillInAddressWithAliasId(info, tab) {
  // Trim the context menu id to get the alias reference ID
  const selectedAliasId = info.menuItemId.replace(
    "fx-private-relay-use-existing-alias_",
    ""
  );

  // Get stored alias data
  const { relayAddresses } = await browser.storage.local.get("relayAddresses");

  // Select the correct alias from the stored alias data
  const selectedAliasObject = relayAddresses.filter((alias) => {
    return alias.id === parseInt(selectedAliasId, 10);
  });

  browser.tabs.sendMessage(
    tab.id,
    {
      type: "fillTargetWithRelayAddress",
      targetElementId: info.targetElementId,
      relayAddress: selectedAliasObject[0],
    },
    {
      frameId: info.frameId,
    }
  );
}

function addAliasToExistingAliasContextMenu(alias, parentId) {
  // If there's a label. Set the context menu item title accordingly.
  const title = alias.description ? alias.description : alias.address;
  const id = "fx-private-relay-use-existing-alias_" + alias.id;

  browser.menus.create({
    id,
    type: "radio",
    title,
    parentId,
  });
}

async function generateAliasesContextMenu(aliases, opts) {
  if (opts?.siteOrigin) {
    const parentSiteOriginId =
      "fx-private-relay-use-existing-aliases-from-this-site";

    browser.menus.create({
      id: "fx-private-relay-use-existing-aliases-from-this-site",
      title: "Use existing alias from this site…",
    });

    for (const alias of aliases) {
      addAliasToExistingAliasContextMenu(alias, parentSiteOriginId);
    }

    //   addManageAllLink(parentSiteOriginId);

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
      id: "fx-private-relay-use-existing-aliases",
      title: "Use existing alias",
    });

    for (const alias of aliases) {
      addAliasToExistingAliasContextMenu(alias, parentNonSiteOriginId);
    }

    //   addManageAllLink(parentNonSiteOriginId);
  }
}

// function addManageAllLink() {
  
// }

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

    // If the user has less than five aliases, stop.
    if (!element) {
      break;
    }

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
    generateAliasesContextMenu(siteOriginAddressesArray, {
      siteOrigin: true,
    });
  }

  // Add rest of the available aliases to the context menu
  if (nonSiteOriginAddressesArray.length > 0) {
    generateAliasesContextMenu(nonSiteOriginAddressesArray);
  }

  browser.menus.onClicked.addListener(async (info, tab) => {
    if (selectableAddressesArray.includes(info.menuItemId)) {
      await fillInAddressWithAliasId(info, tab);
    }
  });
}

async function createGenerateAliasContextMenuItem(canGenerateAlias = true) {
  // console.log("createGenerateAliasContextMenuItem");

  const data = {
      id: "fx-private-relay-generate-alias",
      title: browser.i18n.getMessage("pageInputIconGenerateNewAlias"),
      contexts: ["editable"],
      enabled: canGenerateAlias,
  };

  relayContextMenus.menus.create(data)

  // addManageAllLink();

  // initExistingAliasContextMenu();
}

async function checkIfUserCanGenerateAliasContextMenuItem() {
  const { premium } = await browser.storage.local.get("premium");
  const { maxNumAliases } = await browser.storage.local.get("maxNumAliases");
  const { relayAddresses } = await browser.storage.local.get("relayAddresses");
  const aliasesRemaining = maxNumAliases - relayAddresses.length;
  if (!premium && aliasesRemaining < 1) return false;

  return true;
}

function premiumFeaturesAvailable(premiumEnabledString) {
  return premiumEnabledString === "True";
}

// function localStorageWatcher(changes, area) {
//   let changedItems = Object.keys(changes);
//   for (let item of changedItems) {
//     if (item === "relayAddresses") {
//       updateGenerateAliasContextMenuItem(changes[item].newValue.length);
//     }
//     if (item === "apiToken" && changes[item].newValue === undefined) {
//       // User has logged out. Remove all menu items.
//       browser.menus.removeAll();
//     }
//   }
// }

async function updateGenerateAliasContextMenuItem(relayAddressesLength) {
  const { premiumEnabled } = await browser.storage.local.get("premiumEnabled");
  const { premium } = await browser.storage.local.get("premium");
  const { maxNumAliases } = await browser.storage.local.get("maxNumAliases");
  const aliasesRemaining = maxNumAliases - relayAddressesLength;

  if (premiumFeaturesAvailable(premiumEnabled)) {
    if (!premium && aliasesRemaining < 1) {
      // Post-launch: Check if user is premium and under the max limit.
      browser.menus.remove("fx-private-relay-generate-alias");
      createGenerateAliasContextMenuItem(false);
      return;
    }
  } else {
    // TODO: REMOVE THIS BLOCK AFTER PREMIUM LAUNCH
    if (aliasesRemaining < 1) {
      // Current users
      browser.menus.remove("fx-private-relay-generate-alias");
      createGenerateAliasContextMenuItem(false);
      return;
    }
  }

  // Generate Alias link should be visible
  createGenerateAliasContextMenuItem();
}

async function createUpgradeContextMenuItem() {
  browser.menus.create({
    id: "fx-private-relay-get-unlimited-aliases-separator",
    type: "separator",
  });

  browser.menus.create({
    id: "fx-private-relay-get-unlimited-aliases",
    title: browser.i18n.getMessage("pageInputIconGetUnlimitedAliases"),
  });
}

function removeUpgradeContextMenuItem() {
  browser.menus.remove("fx-private-relay-get-unlimited-aliases-separator");
  browser.menus.remove("fx-private-relay-get-unlimited-aliases");
}

async function updateUpgradeContextMenuItem() {
  // console.log("updateUpgradeContextMenuItem");

  await refreshAccountPages();
  // Check for status update
  const { premiumEnabled } = await browser.storage.local.get("premiumEnabled");
  const { premium } = await browser.storage.local.get("premium");

  if (premiumFeaturesAvailable(premiumEnabled)) {
    if (!premium) {
      // Remove any previous upgrade menu items first!
      removeUpgradeContextMenuItem();
      await createUpgradeContextMenuItem();
      return;
    }

    // Remove the upgrade item, if the user is upgraded
    else {
      removeUpgradeContextMenuItem();
    }
  }
}

async function refreshAccountPages() {
  const { settingsRefresh } = await browser.storage.local.get(
    "settingsRefresh"
  );

  // This functions only runs once (when on the dashboard page), if the user has visited the settings page.
  // If they revisit the settings page, it resets so that it only runs once again.
  if (!settingsRefresh) {
    browser.storage.local.set({ settingsRefresh: true });

    browser.tabs.query({ url: "http://127.0.0.1/*" }, function (tabs) {
      for (let tab of tabs) {
        browser.tabs.reload(tab.id);
      }
    });
  }
}

browser.menus.onClicked.addListener(async (info, tab) => {
  // console.log("browser.menus.onClicked: ", info.menuItemId);
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
    case "fx-private-relay-manage-aliases":
      // sendMetricsEvent({
      //   category: "Extension: Context Menu",
      //   action: "click",
      //   label: "context-menu-get-unlimited-aliases",
      // });
      const urlManageAliases = `${RELAY_SITE_ORIGIN}/accounts/profile/`;
      await browser.tabs.create({ url: urlManageAliases });
      break;
  }
});

browser.menus.onShown.addListener(async (info, tab) => {
  
  // console.log(info, tab);
  const domain = relayContextMenus.utils.getHostnameFromRegex(tab.url);
  await relayContextMenus.init(domain);
  
  /*
            // Menu ID: "fx-private-relay-use-existing-aliases":  
            Function Outline: 
            Check tab if current aliases menus match last-built domain:
              If yes, do nothing. 
              If new domain, rebuild menu based on new tab info. 
            
            Check if menu count is up to 5. 
            Edge case: If under 5, check if additional aliases have been created since last built. If so, rebuild.
            Edge case: You may need to rebuild if newer aliases are available.   
            */
});

const getUserStatus = {
  generateAliases: async (numberOfAliasesCreated = null)=> {
    const { premium } = await browser.storage.local.get("premium");

    // Short-circuit if the user is premium.
    if (premium) return true;
    
    const { maxNumAliases } = await browser.storage.local.get("maxNumAliases");
    const { relayAddresses } = await browser.storage.local.get("relayAddresses");

    let aliasesRemaining = maxNumAliases - relayAddresses.length;

    if (numberOfAliasesCreated) {
      aliasesRemaining = maxNumAliases - numberOfAliasesCreated.length;
    }
    
    // The user cannot create and additional aliases.
    if (aliasesRemaining < 1) return false;

    return true;
  },
  upgradeToPremium: async()=> {
    const { premium } = await browser.storage.local.get("premium");
  
    // Note: If user is already premium, this will return false.
    return !premium;
  },
}


const staticMenuData = {
  existingAlias: {
    type: "radio",
  },
  generateAliasEnabled: {
    id: "fx-private-relay-generate-alias",
    title: browser.i18n.getMessage("pageInputIconGenerateNewAlias"),
    contexts: ["editable"],
    enabled: true,
  },
  generateAliasDisabled: {
    id: "fx-private-relay-generate-alias",
    title: browser.i18n.getMessage("pageInputIconGenerateNewAlias"),
    contexts: ["editable"],
    enabled: false,
  },
  manageAliases: {
      id: "fx-private-relay-manage-aliases",
      title: browser.i18n.getMessage("ManageAllAliases"),
  },
  upgradeToPremium: {
    id: "fx-private-relay-get-unlimited-aliases",
    title: browser.i18n.getMessage("pageInputIconGetUnlimitedAliases"),
  },
  upgradeToPremiumSeperator: {
    id: "fx-private-relay-get-unlimited-aliases-separator",
    type: "separator",
  },
  useExistingAliasFromWebsite: {
    id: "fx-private-relay-use-existing-aliases-from-this-site",
    title: "Use existing alias from this site…",
  }, 
  useExistingAlias: {
    id: "fx-private-relay-use-existing-aliases",
    title: "Use existing alias",
  }
}

const relayContextMenus = {
  init: async (currentWebsite=null) => {
    // console.log("relayContextMenus.init");

    if (!browser.menus) {
      throw new Error(`Cannot create browser menus`);
    }

    // Remove previous listener as we may update local storage.
    // if ( await browser.storage.onChanged.hasListener(relayContextMenus.listeners.onLocalStorageChange) ) {
    //   await browser.storage.onChanged.removeListener(relayContextMenus.listeners.onLocalStorageChange);
    // }

    // Reset any previously created menus
    browser.menus.removeAll();

    // Generate aliases menu item
    // If a user is maxed out/not premium, the generate item will be disabled.
    const canUserGenerateAliases = await getUserStatus.generateAliases();
    // console.log("canUserGenerateAliases: ", canUserGenerateAliases);
    canUserGenerateAliases ? relayContextMenus.menus.create(staticMenuData.generateAliasEnabled) : relayContextMenus.menus.create(staticMenuData.generateAliasDisabled);

    // Create Use Existing Alias submenu
    // TODO: Add logic to build based on current website, rather than past five created aliases.
    if (currentWebsite) {
      relayContextMenus.menus.create(staticMenuData.useExistingAliasFromWebsite);
      relayContextMenus.menus.create(staticMenuData.existingAlias, {
        createExistingAliases: true,
        parentId: staticMenuData.useExistingAliasFromWebsite.id,
        currentWebsite
      })
      
    } else {
      relayContextMenus.menus.create(staticMenuData.useExistingAlias);
      relayContextMenus.menus.create(staticMenuData.existingAlias, {
        createExistingAliases: true,
        parentId: staticMenuData.useExistingAlias.id,
        currentWebsite
      })

    }

    

    // Create "Manage all aliases" link
    relayContextMenus.menus.create(staticMenuData.manageAliases);

    // Generate upgrade menu item for non-premium users
    const canUserUpgradeToPremium = await getUserStatus.upgradeToPremium();
    // console.log("canUserUpgradeToPremium", canUserUpgradeToPremium);
    if (canUserUpgradeToPremium) relayContextMenus.menus.create([staticMenuData.upgradeToPremiumSeperator, staticMenuData.upgradeToPremium]);

    // Set listerners
    await browser.storage.onChanged.addListener(relayContextMenus.listeners.onLocalStorageChange);    
  },
  listeners: {
    onLocalStorageChange: async (changes, area) => {
      // console.log("relayContextMenus.listeners.onLocalStorageChange", changes, area);
      let changedItems = Object.keys(changes);
      for (let item of changedItems) {
        if (item === "relayAddresses") {
          // console.log("relayAddresses", changes);
          console.log("onLocalStorageChange-init");
          await relayContextMenus.init();
        }

        if (item === "apiToken" && changes[item].newValue === undefined) {
          // User has logged out. Remove all menu items.
          await browser.menus.removeAll();
        }
      }
    },
  },
  menus: {
    create: async (data, opts=null) => {     
      // If multiple items need to be created: 
      if (Array.isArray(data)) {
        data.forEach(menu => {
          browser.menus.create(menu, relayContextMenus.utils.onCreatedCallback);
        });

        return;
      }

      // Loop Through Existing Aliases
      if (opts?.createExistingAliases) {
        // console.log("opts?.createExistingAliases");
        
        // Get aliases         
        if ( await getServerStoragePref() ) {
          // If you can grab from server, do so.
          // TODO: Edgecase Fix if API doesn't respond (use local)
          const aliases = await getAliasesFromServer();
          let filteredAliases = opts.currentWebsite ? relayContextMenus.utils.getAliasesFromWebsite(aliases, opts.currentWebsite) : relayContextMenus.utils.getMostRecentAliases(aliases);

          // // Cache server set locally
          // browser.storage.local.set({ relayAddresses: aliases });

          for (const alias of filteredAliases) {
            const title = alias.description ? alias.description : alias.address;
            const id = "fx-private-relay-use-existing-alias_" + alias.id;
            data.title = title;
            data.id = id;
            data.parentId = opts.parentId;
            browser.menus.create(data, relayContextMenus.utils.onCreatedCallback);
          }

        }

        // Loop through each, creating menu
        
        
        return;
      }

      browser.menus.create(data, relayContextMenus.utils.onCreatedCallback);
      
    },
    remove: (id) => {
      browser.menus.remove(id);
    }
  }, 
  utils: {
    getMostRecentAliases: (array)=> {
      // console.log("getMostRecentAliases");
      array.reverse();
      if (array.length > 5) { array.length = 5 };
      return array;
    },
    getAliasesFromWebsite: (array, domain)=> {
      // console.log("getAliasesFromWebsite: ", domain);
      array.reverse();
      if (array.length > 5) { array.length = 5 };
      return array;
    },
    getHostnameFromRegex: (url) => {
      // https://stackoverflow.com/a/54947757
      // run against regex
      const matches = url.match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i);
      // extract hostname (will be null if no match is found)
      return matches && matches[1];
    },  
    onCreatedCallback: ()=> {
      // console.log("relayContextMenus.utils.onCreatedCallback");

      // Catch errors when trying to create the same menu twice.
      // The browser.menus API is limited. You cannot query if a menu item already exists.
      // The error it throws does not show up to the user.

      if (browser.runtime.lastError) {
        return;
      }
    }
    
    
  }
};

(async () => {
  // console.log("async-init");
  await relayContextMenus.init();
})();
