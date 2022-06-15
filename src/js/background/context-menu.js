/* global patchMaskInfo */

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
    title: browser.i18n.getMessage(
      "pageInputIconUseExistingAliasFromTheSite_mask"
    ),
    visible: true,
    contexts: ["all"],
  },
  useExistingAlias: {
    id: "fx-private-relay-use-existing-aliases",
    title: browser.i18n.getMessage("pageInputIconRecentAliases_mask"),
    visible: true,
    contexts: ["all"],
  },
};

// Existing Relay/random aliases will get their own context menu items,
// identified by the following prefix followed by their alias ID:
const reuseAliasMenuIdPrefix = "fx-private-relay-use-existing-alias_";

async function getCachedServerStoragePref() {
  const serverStoragePref = await browser.storage.local.get("server_storage");
  const serverStoragePrefInLocalStorage = Object.prototype.hasOwnProperty.call(
    serverStoragePref,
    "server_storage"
  );

  if (!serverStoragePrefInLocalStorage) {
    // There is no reference to the users storage preference saved. Fetch it from the server.
    return await getServerStoragePref();
  } else {
    // If the stored pref exists, return value
    return serverStoragePref.server_storage;
  }
}

// This object is defined as global in the ESLint config _because_ it is created here:
// eslint-disable-next-line no-redeclare
const relayContextMenus = {
  init: async (currentWebsite = null) => {
    if (!browser.contextMenus) {
      throw new Error(`Cannot create browser menus`);
    }

    // Remove the listener so we don't add the same one multiple times
    if (
      browser.storage.onChanged.hasListener(
        relayContextMenus.listeners.onLocalStorageChange
      )
    ) {
      await browser.storage.onChanged.removeListener(
        relayContextMenus.listeners.onLocalStorageChange
      );
    }

    const userApiToken = await browser.storage.local.get("apiToken");
    const apiKeyInStorage = Object.prototype.hasOwnProperty.call(
      userApiToken,
      "apiToken"
    );

    if (!apiKeyInStorage) {
      // User is not logged in. Do not do anything.
      return;
    }

    // Reset any previously created menus
    await browser.contextMenus.removeAll();

    // Generate aliases menu item
    // If a user is maxed out/not premium, the generate item will be disabled.
    const canUserGenerateAliases =
      await relayContextMenus.utils.getUserStatus.canGenerateMoreAliases();
    const menuData = canUserGenerateAliases
      ? staticMenuData.generateAliasEnabled
      : staticMenuData.generateAliasDisabled;
    relayContextMenus.menus.create(menuData);

    // COMPATIBILITY NOTE: Chrome uses the contextMenus API to create menus. Firefox built their own API, menus, based on it. It has additional features that are only available in Firefox. Anything wrapped in a (browser.menus) check is only executed in a browser that supports it.
    if (browser.menus) {
      const userHasSomeAliasesCreated =
        (await relayContextMenus.utils.getUserStatus.getNumberOfAliases()) > 0;

      const aliases = await relayContextMenus.utils.getAliases();

      const masksWereGeneratedOrUsedOnCurrentWebsite =
        await relayContextMenus.utils.checkIfAnyMasksWereGeneratedOrUsedOnCurrentWebsite(
          currentWebsite
        );

      // Create Use Existing Alias submenu
      if (
        currentWebsite &&
        masksWereGeneratedOrUsedOnCurrentWebsite &&
        userHasSomeAliasesCreated
      ) {
        await relayContextMenus.menus.create(
          staticMenuData.existingAlias,
          {
            createExistingAliases: true,
            parentMenu: staticMenuData.useExistingAliasFromWebsite,
            exisitingSite: true,
            currentWebsite,
          },
          aliases
        );
      }

      // Create "Recent Aliases…" menu
      if (userHasSomeAliasesCreated) {
        await relayContextMenus.menus.create(
          staticMenuData.existingAlias,
          {
            createExistingAliases: true,
            parentMenu: staticMenuData.useExistingAlias,
            exisitingSite: false,
            currentWebsite,
          },
          aliases
        );
      }
    }

    // Create "Manage all aliases" link
    await relayContextMenus.menus.create(staticMenuData.manageAliases);

    // Generate upgrade menu item for non-premium users
    const canUserUpgradeToPremium =
      await relayContextMenus.utils.getUserStatus.canUpgradeToPremium();
    if (canUserUpgradeToPremium) {
      // COMPATIBILITY NOTE: The Chrome contextMenus API create() argument params do not support icons
      if (browser.menus) {
        staticMenuData.upgradeToPremium.icons = { 32: "/icons/icon_32.png" };
      }

      await relayContextMenus.menus.create(
        staticMenuData.upgradeToPremiumSeperator
      );
      await relayContextMenus.menus.create(staticMenuData.upgradeToPremium);
    }

    // Set listerners
    browser.storage.onChanged.addListener(
      relayContextMenus.listeners.onLocalStorageChange
    );

    // COMPATIBILITY NOTE: Refresh menus (not available on Chrome contextMenus API)
    if (browser.menus) {
      await browser.menus.refresh();
    }

    return Promise.resolve(1);
  },
  listeners: {
    onFillInAddressWithAliasId: async (info, tab) => {
      // Trim the context menu id to get the alias reference ID
      const selectedAliasId = info.menuItemId.replace(
        reuseAliasMenuIdPrefix,
        ""
      );
      // Get stored alias data
      const relayAddresses = await relayContextMenus.utils.getAliases();

      // Select the correct alias from the stored alias data
      const selectedAliasObject = relayAddresses.filter((alias) => {
        return alias.id === parseInt(selectedAliasId, 10);
      });

      const serverStoragePref = await getCachedServerStoragePref();

      const currentMaskType = selectedAliasObject[0].mask_type;
      const currentUsedOnValue = selectedAliasObject[0].used_on;

      const currentPage = new URL(tab.url);
      const currentPageHostName = currentPage.hostname;

      const used_on = relayContextMenus.utils.checkAndStoreUsedOnDomain(
        currentUsedOnValue,
        currentPageHostName
      );

      // Update server info with site usage
      const data = { used_on };
      const options = {
        auth: true,
        mask_type: currentMaskType,
      };

      // Save what site this mask was used on before filling input
      if (serverStoragePref) {
        await patchMaskInfo(
          "PATCH",
          parseInt(selectedAliasId, 10),
          data,
          options
        );
      } else {
        // Set the used_on field for the selected mask and the re-save the entire masks collection to local storage. 
        selectedAliasObject[0].used_on = used_on;
        browser.storage.local.set({ relayAddresses: relayAddresses });
      }

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
    },
  },
  menus: {
    create: async (data, options = null, aliases) => {
      // Loop Through Existing Aliases
      if (options?.createExistingAliases) {
        // https://github.com/mozilla/fx-private-relay-add-on/issues/239
        // There is a bug in the order in which the aliases are stored when synced with the server versus local storage.
        // We need to determine which method is used to determine if need to flip that order.
        const shouldAliasOrderBeReversed = await getCachedServerStoragePref();

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
          await browser.contextMenus.create(
            options.parentMenu,
            relayContextMenus.utils.onCreatedCallback
          );
        } else {
          // Exit early. Nothing else to create.
          return Promise.resolve(1);
        }

        const STRING_LENGTH = 30;

        for (const alias of filteredAliases) {
          let title = alias.description
            ? alias.description
            : alias.full_address;

          if (title.length > STRING_LENGTH) {
            title = title.substr(0, STRING_LENGTH - 1) + "…";
          }

          const id = reuseAliasMenuIdPrefix + alias.id;

          data.title = title;
          data.id = id;
          data.parentId = options.parentMenu.id;
          await browser.contextMenus.create(
            data,
            relayContextMenus.utils.onCreatedCallback
          );
        }

        return Promise.resolve(1);
      }

      await browser.contextMenus.create(
        data,
        relayContextMenus.utils.onCreatedCallback
      );

      return Promise.resolve(1);
    },
    remove: async (id) => {
      await browser.contextMenus.remove(id);
    },
  },
  utils: {
    getAliases: async () => {
      let options = {};

      const { premium } = await browser.storage.local.get("premium");
      // Check if user may have custom domain masks
      const { premiumSubdomainSet } = await browser.storage.local.get(
        "premiumSubdomainSet"
      );

      // API Note: If a user has not registered a subdomain yet, its default stored/queried value is "None";
      const isPremiumSubdomainSet = premiumSubdomainSet !== "None";

      // Short-circuit if the user is premium.
      if (premium && isPremiumSubdomainSet) {
        options = {
          fetchCustomMasks: true,
        };
      }

      const serverStoragePref = await getCachedServerStoragePref();

      if (serverStoragePref) {
        try {
          const resp = await getAliasesFromServer("GET", options);
          return resp;
        } catch (error) {
          // API Error — Fallback to local storage
          const { relayAddresses } = await browser.storage.local.get(
            "relayAddresses"
          );
          return relayAddresses;
        }
      }

      // User is not syncing with the server. Use local storage.
      const { relayAddresses } = await browser.storage.local.get(
        "relayAddresses"
      );
      return relayAddresses;
    },
    checkIfAnyMasksWereGeneratedOrUsedOnCurrentWebsite: async (website) => {
      const relayAddresses = await relayContextMenus.utils.getAliases();

      // Short circuit if not current site detected
      if (website === null) {
        return false;
      }

      return relayAddresses.some(
        (alias) =>
          website === alias.generated_for || alias.used_on?.includes(website)
      );
    },
    getHostnameFromUrlConstructor: (url) => {
      const { hostname } = new URL(url);
      return hostname;
    },
    getMostRecentAliases: (array, domain) => {
      array.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

      // Remove any sites that match the current site (inverse of getSiteSpecificAliases())
      const filteredAliases = array.filter(
        (alias) =>
          alias.generated_for !== domain && !alias.used_on?.includes(domain)
      );

      // Limit to 5
      return filteredAliases.slice(0, 5);
    },
    getSiteSpecificAliases: (array, domain) => {
      array.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

      const filteredAliases = array.filter(
        (alias) =>
          alias.generated_for === domain ||
          relayContextMenus.utils.hasMaskBeenUsedOnCurrentSite(alias, domain)
      );

      // If 5 results for specific domain
      return filteredAliases.slice(0, 5);
    },
    getUserStatus: {
      canGenerateMoreAliases: async () => {
        const { premium } = await browser.storage.local.get("premium");

        // Short-circuit if the user is premium.
        if (premium) return true;

        const { maxNumAliases } = await browser.storage.local.get(
          "maxNumAliases"
        );
        const relayAddresses = await relayContextMenus.utils.getAliases();

        return maxNumAliases - relayAddresses.length > 0;
      },
      getNumberOfAliases: async () => {
        const relayAddresses = await relayContextMenus.utils.getAliases();
        return relayAddresses.length;
      },
      canUpgradeToPremium: async () => {
        const { premium } = await browser.storage.local.get("premium");

        const premiumCountryAvailability = (
          await browser.storage.local.get("premiumCountries")
        )?.premiumCountries;

        // Note: If user is already premium, this will return false.
        return (
          !premium &&
          premiumCountryAvailability?.premium_available_in_country === true
        );
      },
    },
    checkAndStoreUsedOnDomain: (domainList, currentDomain) => {

      // If the used_on field is blank, then just set it to the current page/hostname. Otherwise, add/check if domain exists in the field
      if (
        currentDomain === null ||
        currentDomain === "" ||
        currentDomain === undefined
      ) {
        return currentDomain;
      }

      // Domain already exists in used_on field. Just return the list!
      if (domainList.includes(currentDomain)) {
        return domainList;
      }

      // Domain DOES NOT exist in used_on field. Add it to the domainList and put it back as a CSV string.
      // If there's already an entry, add a comma too
      domainList += domainList !== "" ? `,${currentDomain}` : currentDomain;
      return domainList;
    },
    hasMaskBeenUsedOnCurrentSite: (mask, domain) => {
      const domainList = mask.used_on;

      // Short circuit out if there's no used_on entry
      if (
        domainList === null ||
        domainList === "" ||
        domainList === undefined
      ) {
        return false;
      }

      // Domain already exists in used_on field. Just return the list!
      if (domainList.includes(domain)) {
        return true;
      }

      // No match found!
      return false;
    },
    onCreatedCallback: () => {
      // Catch errors when trying to create the same menu twice.
      // The browser.contextMenus API is limited. You cannot query if a menu item already exists.
      // The error it throws does not show up to the user.

      if (browser.runtime.lastError) {
        return;
      }
    },
  },
};

// Events

// COMPATIBILITY NOTE: The onShown event is not available on the Chrome contextMenus API
if (browser.menus) {
  browser.menus.onShown.addListener(async (info, tab) => {
    if (!info.menuIds.includes("fx-private-relay-generate-alias")) {
      // No Relay menu items exist. Stop listening.
      return;
    }

    const domain = relayContextMenus.utils.getHostnameFromUrlConstructor(
      tab.url
    );
    await relayContextMenus.init(domain);
  });
}
browser.contextMenus.onClicked.addListener(async (info, tab) => {
  const { relaySiteOrigin } = await browser.storage.local.get(
    "relaySiteOrigin"
  );
  const urlPremium = `${relaySiteOrigin}/premium?utm_source=fx-relay-addon&utm_medium=context-menu&utm_content=get-premium-link`;
  const urlManageAliases = `${relaySiteOrigin}/accounts/profile/`;
  switch (info.menuItemId) {
    case "fx-private-relay-generate-alias":
      sendMetricsEvent({
        category: "Extension: Context Menu",
        action: "click",
        label: "context-menu-generate-alias",
      });
      await relayContextMenus.listeners.onMakeRelayAddressForTargetElement(
        info,
        tab
      );
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
