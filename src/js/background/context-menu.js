// The static data used to create different context menu items. 
// These are the same everytime, as opposed to the dynamic menu items: reusing aliases
// See these docs to better understead the context menu paramaters
// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/menus/create#parameters 
const staticMenuData = {
  existingAlias: {
    type: "radio",
    visible: true,
    contexts: ["all"],
  },
  generateAliasEnabled: {
    id: "fx-private-relay-generate-alias",
    title: browser.i18n.getMessage("pageInputIconGenerateNewAlias_mask"),
    enabled: true,
    visible: true,
    contexts: ["all"],
  },
  generateAliasDisabled: {
    id: "fx-private-relay-generate-alias",
    title: browser.i18n.getMessage("pageInputIconGenerateNewAlias_mask"),
    enabled: false,
    visible: true,
    contexts: ["all"],
  },
  manageAliases: {
    id: "fx-private-relay-manage-aliases",
    title: browser.i18n.getMessage("ManageAllAliases_mask"),
    visible: true,
    contexts: ["all"],
  },
  upgradeToPremium: {
    id: "fx-private-relay-get-unlimited-aliases",
    title: browser.i18n.getMessage("pageInputIconGetUnlimitedAliases_mask"),
    visible: true,
    contexts: ["all"],
  },
  upgradeToPremiumSeperator: {
    id: "fx-private-relay-get-unlimited-aliases-separator",
    type: "separator",
    visible: true,
    contexts: ["all"],
  },
  useExistingAliasFromWebsite: {
    id: "fx-private-relay-use-existing-aliases-from-this-site",
    title: browser.i18n.getMessage("pageInputIconUseExistingAliasFromTheSite_mask"),
    visible: true,
    contexts: ["all"],
  }, 
  useExistingAlias: {
    id: "fx-private-relay-use-existing-aliases",
    title: browser.i18n.getMessage("pageInputIconRecentAliases_mask"),
    visible: true,
    contexts: ["all"],
  }
}

// Existing Relay/random aliases will get their own context menu items,
// identified by the following prefix followed by their alias ID:
const reuseAliasMenuIdPrefix = "fx-private-relay-use-existing-alias_";

// This object is defined as global in the ESLint config _because_ it is created here:
// eslint-disable-next-line no-redeclare
const relayContextMenus = {
  init: async (currentWebsite=null) => {
    
    if (!browser.contextMenus) {
      throw new Error(`Cannot create browser menus`);
    }

    // Remove the listener so we don't add the same one multiple times
    if (browser.storage.onChanged.hasListener(relayContextMenus.listeners.onLocalStorageChange)) {
      await browser.storage.onChanged.removeListener(relayContextMenus.listeners.onLocalStorageChange);
    }
    

    const userApiToken = await browser.storage.local.get("apiToken");
    const apiKeyInStorage = Object.prototype.hasOwnProperty.call(userApiToken, "apiToken");

    if (!apiKeyInStorage) {
      // User is not logged in. Do not do anything.
      return;
    }

    // Reset any previously created menus
    await browser.contextMenus.removeAll();

    // Generate aliases menu item
    // If a user is maxed out/not premium, the generate item will be disabled.
    const canUserGenerateAliases = await relayContextMenus.utils.getUserStatus.canGenerateMoreAliases();
    const menuData = canUserGenerateAliases ? staticMenuData.generateAliasEnabled : staticMenuData.generateAliasDisabled;
    relayContextMenus.menus.create(menuData);


    // COMPATIBILITY NOTE: Chrome uses the contextMenus API to create menus. Firefox built their own API, menus, based on it. It has additional features that are only available in Firefox. Anything wrapped in a (browser.menus) check is only executed in a browser that supports it. 
    if (browser.menus) {
      const userHasSomeAliasesCreated = (await relayContextMenus.utils.getUserStatus.getNumberOfAliases() > 0);
      
      const aliases = await relayContextMenus.utils.getAliases();

      // Create Use Existing Alias submenu
      if (currentWebsite &&  await relayContextMenus.utils.getGeneratedForHistory(currentWebsite) && userHasSomeAliasesCreated ) {
        await relayContextMenus.menus.create(staticMenuData.existingAlias, {
          createExistingAliases: true,
          parentMenu: staticMenuData.useExistingAliasFromWebsite,
          exisitingSite: true,
          currentWebsite
        }, aliases);
      } 

      // Create "Recent Aliases…" menu
      if ( userHasSomeAliasesCreated ) {
        await relayContextMenus.menus.create(staticMenuData.existingAlias, {
          createExistingAliases: true,
          parentMenu: staticMenuData.useExistingAlias,
          exisitingSite: false,
          currentWebsite
        }, aliases)
      }

    }

    // Create "Manage all aliases" link
    await relayContextMenus.menus.create(staticMenuData.manageAliases);

    // Generate upgrade menu item for non-premium users
    const canUserUpgradeToPremium = await relayContextMenus.utils.getUserStatus.canUpgradeToPremium();
    if (canUserUpgradeToPremium) {

      // COMPATIBILITY NOTE: The Chrome contextMenus API create() argument params do not support icons 
      if (browser.menus) {
        staticMenuData.upgradeToPremium.icons =  {32: "/icons/icon_32.png"};
      }

      await relayContextMenus.menus.create(staticMenuData.upgradeToPremiumSeperator);
      await relayContextMenus.menus.create(staticMenuData.upgradeToPremium);
    }

    // Set listerners
    browser.storage.onChanged.addListener(relayContextMenus.listeners.onLocalStorageChange);        

    // COMPATIBILITY NOTE: Refresh menus (not available on Chrome contextMenus API)
    if (browser.menus) {
      await browser.menus.refresh();
    }

    return Promise.resolve(1)

  },
  listeners: {
    onFillInAddressWithAliasId: async (info, tab) => {
      // Trim the context menu id to get the alias reference ID
      const selectedAliasId = info.menuItemId.replace(
        reuseAliasMenuIdPrefix,
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
      
    },
    onLocalStorageChange: async (changes, _area) => {
      let changedItems = Object.keys(changes);
      for (let item of changedItems) {
        if (item === "relayAddresses") {
          // WIP/Known Bug: Running getAliasesFromServer() causes this localStorageChange event to loop
          // await relayContextMenus.init();
        }

        if (item === "apiToken" && changes[item].newValue === undefined) {
          // User has logged out. Remove all menu items.
          await browser.contextMenus.removeAll();
        }
      }
    },    
    onMakeRelayAddressForTargetElement: async (info, tab) => {
      const pageUrl = new URL(info.pageUrl);
      const newRelayAddress = await makeRelayAddress(pageUrl.hostname);
    
      if (newRelayAddress.status === 402) {
        browser.tabs.sendMessage(tab.id, {
          type: "showMaxNumAliasesMessage",
        });
        return;
      }
    
      await browser.tabs.sendMessage(
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
  },
  menus: {
    create: async (data, options=null, aliases) => {     
      // Loop Through Existing Aliases
      if (options?.createExistingAliases) {
        
        // https://github.com/mozilla/fx-private-relay-add-on/issues/239 
        // There is a bug in the order in which the aliases are stored when synced with the server versus local storage. 
        // We need to determine which method is used to determine if need to flip that order.  
        const shouldAliasOrderBeReversed = await getServerStoragePref();

        const filteredAliases = options.exisitingSite
          ? relayContextMenus.utils.getSiteSpecificAliases(
              aliases,
              options.currentWebsite,
              { shouldAliasOrderBeReversed }
            )
          : relayContextMenus.utils.getMostRecentAliases(
              aliases,
              options.currentWebsite,
              { shouldAliasOrderBeReversed }
            );

        // Only create the parent menu if we will create sub-items
        if (filteredAliases.length > 0) {
          await browser.contextMenus.create(options.parentMenu, relayContextMenus.utils.onCreatedCallback);
        } else {
          // Exit early. Nothing else to create.
          return Promise.resolve(1);
        }

        for (const alias of filteredAliases) {
          const title = alias.description ? alias.description : alias.address;
          const id = reuseAliasMenuIdPrefix + alias.id;
          
          
          data.title = title;
          data.id = id;
          data.parentId = options.parentMenu.id;
          await browser.contextMenus.create(data, relayContextMenus.utils.onCreatedCallback);
        }
        
        return Promise.resolve(1)
      }

      await browser.contextMenus.create(data, relayContextMenus.utils.onCreatedCallback);

      return Promise.resolve(1)
      
    },
    remove: async (id) => {
      await browser.contextMenus.remove(id);
    }
  }, 
  utils: {
    getAliases: async () => {
      let options = {};

      const { premium } = await browser.storage.local.get("premium");
      // Check if user may have custom domain masks
      const { premiumSubdomainSet } = await browser.storage.local.get("premiumSubdomainSet");

      // API Note: If a user has not registered a subdomain yet, its default stored/queried value is "None";
      const isPremiumSubdomainSet = (premiumSubdomainSet !== "None");
    
      // Short-circuit if the user is premium.
      if (premium && isPremiumSubdomainSet) {
        options = {
          fetchCustomMasks: true
        }
      }
      
      
      if (await getServerStoragePref()) {
        try {
          return await getAliasesFromServer("GET", options);
        } catch (error) {
          // API Error — Fallback to local storage
          const { relayAddresses } = await browser.storage.local.get("relayAddresses");
          return relayAddresses;
        }
      }

      // User is not syncing with the server. Use local storage.
      const { relayAddresses } = await browser.storage.local.get("relayAddresses");
      return relayAddresses;
      
    },
    getGeneratedForHistory: async (website) => {
      const { relayAddresses } = await browser.storage.local.get("relayAddresses");
      
      return relayAddresses.some(alias => website === alias.generated_for);
    },
    getHostnameFromUrlConstructor: (url) => {
      const { hostname } = new URL(url);
      return hostname;
    },  
    getMostRecentAliases: (array, domain)=> {
      array.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

      // Remove any sites that match the current site (inverse of getSiteSpecificAliases())
      const filteredAliases = array.filter(alias => alias.generated_for !== domain);

      // Limit to 5
      return filteredAliases.slice(0, 5);
    },
    getSiteSpecificAliases: (array, domain)=> {
      array.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      
      const filteredAliases = array.filter(alias => alias.generated_for === domain);

      // If 5 results for specific domain
      return filteredAliases.slice(0, 5);
    },
    getUserStatus: {
      canGenerateMoreAliases: async ()=> {
        const { premium } = await browser.storage.local.get("premium");
    
        // Short-circuit if the user is premium.
        if (premium) return true;
        
        const { maxNumAliases } = await browser.storage.local.get("maxNumAliases");
        const { relayAddresses } = await browser.storage.local.get("relayAddresses");

        return (maxNumAliases - relayAddresses.length) > 0;
      },
      getNumberOfAliases: async () => {
        const { relayAddresses } = await browser.storage.local.get("relayAddresses");
        return relayAddresses.length;
      },
      canUpgradeToPremium: async()=> {
        const { premium } = await browser.storage.local.get("premium");
      
        const premiumCountryAvailability = (await browser.storage.local.get("premiumCountries"))?.premiumCountries;

        // Note: If user is already premium, this will return false.
        return !premium && premiumCountryAvailability?.premium_available_in_country === true;
      },
    },
    onCreatedCallback: ()=> {
      // Catch errors when trying to create the same menu twice.
      // The browser.contextMenus API is limited. You cannot query if a menu item already exists.
      // The error it throws does not show up to the user.

      if (browser.runtime.lastError) {
        return;
      }
    }
  }
};

// Events

// COMPATIBILITY NOTE: The onShown event is not available on the Chrome contextMenus API
if (browser.menus) {
  browser.menus.onShown.addListener(async (info, tab) => {
    if (!info.menuIds.includes("fx-private-relay-generate-alias") ) {
      // No Relay menu items exist. Stop listening.
      return;
    }
  
    const domain = relayContextMenus.utils.getHostnameFromUrlConstructor(tab.url);
    await relayContextMenus.init(domain);
  });
}


browser.contextMenus.onClicked.addListener(async (info, tab) => {
  const { relaySiteOrigin } = await browser.storage.local.get("relaySiteOrigin");
  const urlPremium = `${relaySiteOrigin}/premium?utm_source=fx-relay-addon&utm_medium=context-menu&utm_content=get-premium-link`;
  const urlManageAliases = `${relaySiteOrigin}/accounts/profile/`;
  switch (info.menuItemId) {
    case "fx-private-relay-generate-alias":
      sendMetricsEvent({
        category: "Extension: Context Menu",
        action: "click",
        label: "context-menu-generate-alias",
      });
      await relayContextMenus.listeners.onMakeRelayAddressForTargetElement(info, tab);
      break;
    case "fx-private-relay-get-unlimited-aliases":
      sendMetricsEvent({
        category: "Extension: Context Menu",
        action: "click",
        label: "context-menu-get-unlimited-aliases",
      });
      await browser.tabs.create({ url: urlPremium });
      break;
    case "fx-private-relay-manage-aliases":
      sendMetricsEvent({
        category: "Extension: Context Menu",
        action: "click",
        label: "context-menu-relay-manage-aliases",
      });
      await browser.tabs.create({ url: urlManageAliases });
      break;
  }

  if (info.menuItemId.startsWith(reuseAliasMenuIdPrefix)) {
    sendMetricsEvent({
      category: "Extension: Context Menu",
      action: "click",
      label: "context-menu-" + info.parentMenuItemId,
    });
    await relayContextMenus.listeners.onFillInAddressWithAliasId(info, tab);
  }

});

(async () => {
  await relayContextMenus.init();
})();