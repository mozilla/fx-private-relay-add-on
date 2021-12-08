
// The static data used to create different context menu items. 
// These are the same everytime, as opposed to the dynamic menu items: reusing aliases
// See these docs to better understead the context menu paramaters
// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/menus/create#parameters 
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
    icons: {
      16: "/icons/placeholder-logo.png",
    },
  },
  upgradeToPremiumSeperator: {
    id: "fx-private-relay-get-unlimited-aliases-separator",
    type: "separator",
  },
  useExistingAliasFromWebsite: {
    id: "fx-private-relay-use-existing-aliases-from-this-site",
    title: browser.i18n.getMessage("pageInputIconUseExistingAliasFromTheSite"),
  }, 
  useExistingAlias: {
    id: "fx-private-relay-use-existing-aliases",
    title: browser.i18n.getMessage("pageInputIconRecentAliases"),
  }
}

// Existing Relay/random aliases will get their own context menu items,
// identified by the following prefix followed by their alias ID:
const reuseAliasMenuIdPrefix = "fx-private-relay-use-existing-alias_";

const relayContextMenus = {
  init: async (currentWebsite=null) => {
    
    if (!browser.menus) {
      throw new Error(`Cannot create browser menus`);
    }

    // Remove the listener so we don't add the same one multiple times
    if (browser.storage.onChanged.hasListener(relayContextMenus.listeners.onLocalStorageChange)) {
      await browser.storage.onChanged.removeListener(relayContextMenus.listeners.onLocalStorageChange);
    }
    

    const userApiToken = await browser.storage.local.get("apiToken");
    const apiKeyInStorage = userApiToken.hasOwnProperty("apiToken");

    if (!apiKeyInStorage) {
      // User is not logged in. Do not do anything.
      return;
    }

    // Reset any previously created menus
    await browser.menus.removeAll();

    // Generate aliases menu item
    // If a user is maxed out/not premium, the generate item will be disabled.
    const canUserGenerateAliases = await relayContextMenus.utils.getUserStatus.canGenerateMoreAliases();
    const menuData = canUserGenerateAliases ? staticMenuData.generateAliasEnabled : staticMenuData.generateAliasDisabled;
    relayContextMenus.menus.create(menuData);

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

    // Create "Manage all aliases" link
    await relayContextMenus.menus.create(staticMenuData.manageAliases);

    // Generate upgrade menu item for non-premium users
    const canUserUpgradeToPremium = await relayContextMenus.utils.getUserStatus.canUpgradeToPremium();
    if (canUserUpgradeToPremium) {
      await relayContextMenus.menus.create(staticMenuData.upgradeToPremiumSeperator);
      await relayContextMenus.menus.create(staticMenuData.upgradeToPremium);
    }

    // Set listerners
    browser.storage.onChanged.addListener(relayContextMenus.listeners.onLocalStorageChange);        

    // Refresh menus
    await browser.menus.refresh();

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
    onLocalStorageChange: async (changes, area) => {
      let changedItems = Object.keys(changes);
      for (let item of changedItems) {
        if (item === "relayAddresses") {
          await relayContextMenus.init();
        }

        if (item === "apiToken" && changes[item].newValue === undefined) {
          // User has logged out. Remove all menu items.
          await browser.menus.removeAll();
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
    create: async (data, opts=null, aliases) => {     
      // Loop Through Existing Aliases
      if (opts?.createExistingAliases) {
        
        const filteredAliases = opts.exisitingSite
          ? relayContextMenus.utils.getSiteSpecificAliases(
              aliases,
              opts.currentWebsite
            )
          : relayContextMenus.utils.getMostRecentAliases(aliases, opts.currentWebsite);

        // Only create the parent menu if we will create sub-items
        if (filteredAliases.length > 0) {
          await browser.menus.create(opts.parentMenu, relayContextMenus.utils.onCreatedCallback);
        } else {
          // Exit early. Nothing else to create.
          return Promise.resolve(1);
        }

        for (const alias of filteredAliases) {
          const title = alias.description ? alias.description : alias.address;
          const id = reuseAliasMenuIdPrefix + alias.id;
          
          
          data.title = title;
          data.id = id;
          data.parentId = opts.parentMenu.id;
          await browser.menus.create(data, relayContextMenus.utils.onCreatedCallback);
        }
        
        return Promise.resolve(1)
      }

      await browser.menus.create(data, relayContextMenus.utils.onCreatedCallback);

      return Promise.resolve(1)
      
    },
    remove: async (id) => {
      await browser.menus.remove(id);
    }
  }, 
  utils: {
    getAliases: async () => {
      if (await getServerStoragePref()) {
        try {
          return await getAliasesFromServer();
        } catch (error) {
          // API Error — Fallback to local storage
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
      // Flipped to match the same order as the dashboard
      array.reverse();

      // Remove any sites that match the current site (inverse of getSiteSpecificAliases())
      const filteredAliases = array.filter(alias => alias.generated_for !== domain);

      // Limit to 5
      return filteredAliases.slice(0, 5);
    },
    getSiteSpecificAliases: (array, domain)=> {

      // Flipped to match the same order as the dashboard
      array.reverse();

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
      // The browser.menus API is limited. You cannot query if a menu item already exists.
      // The error it throws does not show up to the user.

      if (browser.runtime.lastError) {
        return;
      }
    }
  }
};

// Events
browser.menus.onShown.addListener(async (info, tab) => {
  
  if (!info.menuIds.includes("fx-private-relay-generate-alias") ) {
    // No Relay menu items exist. Stop listening.
    return;
  }

  const domain = relayContextMenus.utils.getHostnameFromUrlConstructor(tab.url);
  await relayContextMenus.init(domain);

  if (menuInstanceId !== lastMenuInstanceId) {
    return; // Menu was closed and shown again.
  }
});

browser.menus.onClicked.addListener(async (info, tab) => {
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
      sendMetricsEvent({
        category: "Extension: Context Menu",
        action: "click",
        label: "context-menu-relay-manage-aliases",
      });
      const urlManageAliases = `${RELAY_SITE_ORIGIN}/accounts/profile/`;
      await browser.tabs.create({ url: urlManageAliases });
      break;
  }

  if (info.menuItemId.startsWith(reuseAliasMenuIdPrefix)) {
    await relayContextMenus.listeners.onFillInAddressWithAliasId(info, tab);
  }

});

(async () => {
  await relayContextMenus.init();
})();