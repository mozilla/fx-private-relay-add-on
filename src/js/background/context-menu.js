
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

const relayContextMenus = {
  init: async (currentWebsite=null) => {
    if (!browser.menus) {
      throw new Error(`Cannot create browser menus`);
    }

    // Reset any previously created menus
    await browser.menus.removeAll();

    // Generate aliases menu item
    // If a user is maxed out/not premium, the generate item will be disabled.
    const canUserGenerateAliases = await relayContextMenus.utils.getUserStatus.generateAliases();
    canUserGenerateAliases ? relayContextMenus.menus.create(staticMenuData.generateAliasEnabled) : relayContextMenus.menus.create(staticMenuData.generateAliasDisabled);

    // Create Use Existing Alias submenu
    if (currentWebsite &&  await relayContextMenus.utils.getGeneratedForHistory(currentWebsite) ) {
      relayContextMenus.menus.create(staticMenuData.useExistingAliasFromWebsite);
      relayContextMenus.menus.create(staticMenuData.existingAlias, {
        createExistingAliases: true,
        parentId: staticMenuData.useExistingAliasFromWebsite.id,
        currentWebsite
      })
    }

    // Create "Recent Aliases…" menu
    relayContextMenus.menus.create(staticMenuData.useExistingAlias);
    relayContextMenus.menus.create(staticMenuData.existingAlias, {
      createExistingAliases: true,
      parentId: staticMenuData.useExistingAlias.id,
    })

    // Create "Manage all aliases" link
    relayContextMenus.menus.create(staticMenuData.manageAliases);

    // Generate upgrade menu item for non-premium users
    const canUserUpgradeToPremium = await relayContextMenus.utils.getUserStatus.upgradeToPremium();
    if (canUserUpgradeToPremium) relayContextMenus.menus.create([staticMenuData.upgradeToPremiumSeperator, staticMenuData.upgradeToPremium]);

    // Set listerners
    await browser.storage.onChanged.addListener(relayContextMenus.listeners.onLocalStorageChange);        
  },
  listeners: {
    onFillInAddressWithAliasId: async (info, tab) => {
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
    create: async (data, opts=null) => {     
      // If multiple items need to be created: 
      if (Array.isArray(data)) {
        data.forEach(async (menu) => {
          await browser.menus.create(menu, relayContextMenus.utils.onCreatedCallback);
        });

        return;
      }

      // Loop Through Existing Aliases
      if (opts?.createExistingAliases) {
        
        // TODO: Edgecase Fix if API doesn't respond (use local)
        const aliases = await relayContextMenus.utils.getAliases();
        
        const filteredAliases = opts.currentWebsite
          ? relayContextMenus.utils.getSiteSpecificAliases(
              aliases,
              opts.currentWebsite
            )
          : relayContextMenus.utils.getMostRecentAliases(aliases);

        // // Cache server set locally
        // browser.storage.local.set({ relayAddresses: aliases });
        const currentUseAliasIds = [];

        for (const alias of filteredAliases) {
          const title = alias.description ? alias.description : alias.address;
          const id = "fx-private-relay-use-existing-alias_" + alias.id;
          
          currentUseAliasIds.push(id);
          
          data.title = title;
          data.id = id;
          data.parentId = opts.parentId;
          await browser.menus.create(data, relayContextMenus.utils.onCreatedCallback);
        }
        
        await browser.menus.refresh();

        // Used to parse "use alias" context menus
        await browser.storage.local.set({ currentUseAliasIds });

        return;
      }

      await browser.menus.create(data, relayContextMenus.utils.onCreatedCallback);
      
    },
    remove: async (id) => {
      await browser.menus.remove(id);
    }
  }, 
  utils: {
    getAliases: async () => {

      // TODO: This requires network access/server uptime. 
      // Is there a way to test/fallback to local?
      if ( await getServerStoragePref() ) {
        return await getAliasesFromServer();
      }

      const { relayAddresses } = await browser.storage.local.get("relayAddresses");
      return relayAddresses;

    },
    getGeneratedForHistory: async (website) => {
      const { relayAddresses } = await browser.storage.local.get("relayAddresses");
      
      function checkAvailability(aliases, domain) {
        return aliases.some(function(alias) {
            return domain === alias.generated_for;
        });
      }

      const websiteMatch = checkAvailability(relayAddresses, website)

      return websiteMatch
    },
    getHostnameFromRegex: (url) => {
      // TODO: Unused function
      // https://stackoverflow.com/a/54947757
      // run against regex
      const matches = url.match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i);
      // extract hostname (will be null if no match is found)
      return matches && matches[1];
    },  
    getHostnameFromUrlConstructor: (url) => {
      const { hostname } = new URL(url);
      return hostname;
    },  
    getMostRecentAliases: (array)=> {
      // Flipped to match the same order as the dashboard
      array.reverse();

      // Limit to 5
      if (array.length > 5) { array.length = 5 };
      return array;
    },
    getSiteSpecificAliases: (array, domain)=> {

      // Flipped to match the same order as the dashboard
      array.reverse();

      const filteredAliases = array.filter(alias => alias.generated_for === domain);

      // If 5 results for specific domain
      if (filteredAliases.length > 5) { 
        filteredAliases.length = 5;
        return filteredAliases;
      };

      return filteredAliases
    },
    getUserStatus: {
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

// TLDR: We make sure the menu is still open when performing the refresh command, as to not waste resoruces. 
// This method is taken from https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/menus/onShown documentation. 
let lastMenuInstanceId = 0;
let nextMenuInstanceId = 1;

// Events
browser.menus.onShown.addListener(async (info, tab) => {
  
  if (!info.menuIds.includes("fx-private-relay-generate-alias") ) {
    // No Relay menu items exist. Stop listening.
    return;
  }

  let menuInstanceId = nextMenuInstanceId++;
  lastMenuInstanceId = menuInstanceId;

  const domain = relayContextMenus.utils.getHostnameFromUrlConstructor(tab.url);
  await relayContextMenus.init(domain);

  if (menuInstanceId !== lastMenuInstanceId) {
    return; // Menu was closed and shown again.
  }
});

browser.menus.onHidden.addListener(async (info, tab) => {
  lastMenuInstanceId = 0;
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

  if (info.menuItemId.startsWith("fx-private-relay-use-existing-alias_")) {
    await relayContextMenus.listeners.onFillInAddressWithAliasId(info, tab);
  }

});

(async () => {
  await relayContextMenus.init();
})();

