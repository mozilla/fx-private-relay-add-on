/**
 * @typedef {object} RandomMask
 * @property {boolean} enabled
 * @property {boolean} block_list_emails
 * @property {string} description
 * @property {number} id
 * @property {string} address
 * @property {string} full_address
 * @property {1 | 2} domain
 * @property {string} created_at
 * @property {string} last_modified_at
 * @property {string | null} last_uesd_at
 * @property {number} num_forwarded
 * @property {number} num_blocked
 * @property {number} num_spam
 */

(async function () {
  const dahsboardInitializationObserver = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      if (mutation.type !== "childList") {
        return;
      }
      mutation.addedNodes.forEach(node => {
        if (node.id !== "profile-main") {
          return;
        }

        // Once an element `#profile-main` is added, the dashboard is initialized
        // with the data needed by the add-on; stop watching for futher changes,
        // and run once:
        dahsboardInitializationObserver.disconnect();
        run();
      });
    });
  });
  if (document.getElementById("profile-main") === null) {
    dahsboardInitializationObserver.observe(document.body, { childList: true, subtree: true });
  } else {
    run();
  }

  async function run() {
    // Get the api token from the account profile page
    const profileMainElement = document.querySelector("#profile-main");
    const apiToken = profileMainElement.dataset.apiToken;
    await browser.storage.local.set({ apiToken });

    const cookieString =
    typeof document.cookie === "string" ? document.cookie : "";
    
    const cookieStringArray = cookieString
      .split(";")
      .map((individualCookieString) => individualCookieString.split("="))
      .map(([cookieKey, cookieValue]) => [
        cookieKey.trim(),
        cookieValue.trim(),
      ]);

    const [_csrfCookieKey, csrfCookieValue] = cookieStringArray.find(
      ([cookieKey, _cookieValue]) => cookieKey === "csrftoken"
    );

    await browser.storage.local.set({ csrfCookieValue: csrfCookieValue });


    // API URL is ${RELAY_SITE_ORIGIN}/api/v1/
    const { relayApiSource } = await browser.storage.local.get("relayApiSource");

    const apiProfileURL = `${relayApiSource}/profiles/`;
    const relayApiUrlRelayAddresses = `${relayApiSource}/relayaddresses/`;
    const relayApiUrlDomainAddresses = `${relayApiSource}/domainaddresses/`;

    
    const serverProfileData = await browser.runtime.sendMessage({
      method: "fetchApiRequest",
      url: apiProfileURL
    });

    browser.storage.local.set({
      profileID: parseInt(serverProfileData[0].id, 10),
      server_storage: serverProfileData[0].server_storage,
      has_phone: serverProfileData[0].has_phone,
      has_vpn: serverProfileData[0].has_vpn
    });

    const siteStorageEnabled = serverProfileData[0].server_storage;

    /**
     * Fetch the current list of random masks from the server, while preserving local labels if present
     *
     * @param {{ fetchCustomMasks?: boolean }} options - Set `fetchCustomMasks` to `true` if the user is a Premium user.
     */
    async function refreshLocalLabelCache(options = {}) {
      
      /** @type {RandomMask[]} */
      const relayAddresses = await browser.runtime.sendMessage({
        method: "fetchApiRequest",
        url: relayApiUrlRelayAddresses
      });
      const domainAddresses = options.fetchCustomMasks
        ? await browser.runtime.sendMessage({
          method: "fetchApiRequest",
          url: relayApiUrlDomainAddresses
        })
        : [];
      await browser.storage.local.set({
        relayAddresses:
          (await applyLocalLabels(relayAddresses))
          .concat(await applyLocalLabels(domainAddresses)),
      });
    }

    /**
     * Copy over locally-stored labels to the given addresses
     *
     * If the user has disabled server-side label storage, the add-on may still
     * store data like labels and the websites an address has been used on
     * locally. When we refresh the address data from the server, we'll want to
     * copy over the labels from our local cache of addresses to the new list
     * we just fetched.
     *
     * @param {RandomMask[]} addresses
     * @returns {Promise<RandomMask[]>}
     */
    async function applyLocalLabels(addresses) {
      if (siteStorageEnabled) {
        return addresses;
      }

      const localAddressCache = (await browser.storage.local.get("relayAddresses")).relayAddresses ?? [];
      return addresses.map(address => {
        const matchingLocalAddress = localAddressCache.find((localAddress) => {
          return (
            localAddress.id === address.id &&
            localAddress.address === address.address &&
            localAddress.domain === address.domain
          );
        });

        return {
          ...address,
          description: matchingLocalAddress?.description ?? address.description,
          generated_for: matchingLocalAddress?.generated_for ?? address.generated_for,
          used_on: matchingLocalAddress?.used_on ?? address.used_on,
        };
      });
    }

    // Check if user is premium
    const isPremiumUser = document.querySelector(
        "firefox-private-relay-addon-data"
      ).dataset.hasPremium === "true";
    browser.storage.local.set({ premium: isPremiumUser });

    // Get FXA Stuff
    const fxaSubscriptionsUrl = document.querySelector(
      "firefox-private-relay-addon-data"
    ).dataset.fxaSubscriptionsUrl;
    const aliasesUsedVal = document.querySelector(
      "firefox-private-relay-addon-data"
    ).dataset.aliasesUsedVal;
    const emailsForwardedVal = document.querySelector(
      "firefox-private-relay-addon-data"
    ).dataset.emailsForwardedVal;
    const emailsBlockedVal = document.querySelector(
      "firefox-private-relay-addon-data"
    ).dataset.emailsBlockedVal;
    const emailTrackersRemovedVal = document.querySelector(
      "firefox-private-relay-addon-data"
    ).dataset.emailTrackersRemovedVal;
    const premiumSubdomainSet = document.querySelector(
      "firefox-private-relay-addon-data"
    ).dataset.premiumSubdomainSet;

    browser.storage.local.set({
      fxaSubscriptionsUrl,
      aliasesUsedVal,
      emailsForwardedVal,
      emailsBlockedVal,
      emailTrackersRemovedVal,
      premiumSubdomainSet,
    });

    // Loop through an array of aliases and see if any of them have descriptions, generated_for, or used_on set.
    function aliasesHaveStoredMetadata(aliases) {
      for (const alias of aliases) {
        if (
          typeof alias.description === "string" &&
          alias.description.length > 0
        ) {
          return true;
        }

        if (typeof alias.generated_for === "string" && alias.generated_for.length > 0) {
          return true;
        }

        if (typeof alias.used_on === "string" && alias.used_on.length > 0) {
          return true;
        }
      }
    }

    // Loop through local storage aliases and sync any metadata they have with the server dataset
    async function sendMetaDataToServer(aliases) {
      for (const alias of aliases) {
        const body = {
          description: alias.description ?? "",
          generated_for: alias.generated_for ?? "",
          used_on: alias.used_on ?? "",
        };

        if (body.description.length > 0 || body.generated_for.length > 0 || body.used_on.length > 0) {
          const endpoint = alias.mask_type === "custom" ? relayApiUrlDomainAddresses : relayApiUrlRelayAddresses;
          await browser.runtime.sendMessage({
            method: "fetchApiRequest",
            url: `${endpoint}${alias.id}/`,
            fetchMethod: "PATCH",
            body: JSON.stringify(body),
            opts: {auth: true}
          });
        }
      }
    }

    // Loop through the temp array that is about to be synced with the server dataset and
    // be sure it matches the local storage metadata dataset
    function getAliasesWithUpdatedMetadata(updatedAliases, prevAliases) {
      return prevAliases.map(prevAlias => {
        const updatedAlias = updatedAliases.find(otherAlias => otherAlias.id === prevAlias.id) ?? { description: "", generated_for: "", used_on: ""};
        return {
          ...prevAlias,
          description: updatedAlias.description.length > 0 ? updatedAlias.description : prevAlias.description,
          generated_for: updatedAlias.generated_for.length > 0 ? updatedAlias.generated_for : prevAlias.generated_for,
          used_on: updatedAlias.used_on.length > 0 ? updatedAlias.used_on : prevAlias.used_on,
        };
      }
    )}

    if (siteStorageEnabled) {
      // Sync alias data from server page.
      // If local storage items exist AND have label metadata stored, sync it to the server.
      
      const serverRelayAddresses = await browser.runtime.sendMessage({
        method: "fetchApiRequest",
        url: relayApiUrlRelayAddresses
      });
      
      const serverDomainAddresses = isPremiumUser
        ? await browser.runtime.sendMessage({
          method: "fetchApiRequest",
          url: relayApiUrlDomainAddresses
        })
        : [];

      // let usage: This data may be overwritten when merging the local storage dataset with the server set.
      let localCopyOfServerMasks = serverRelayAddresses.concat(serverDomainAddresses);

      // Check/cache local storage
      const localMasks = (await browser.storage.local.get(
        "relayAddresses"
      )).relayAddresses;

      if (
        localMasks &&
        localMasks.length > 0 &&
        aliasesHaveStoredMetadata(localMasks) && // Make sure there is meta data in the local dataset
        !aliasesHaveStoredMetadata(localCopyOfServerMasks) // Make sure there is no meta data in the server dataset
      ) {
        await sendMetaDataToServer(localMasks);
        localCopyOfServerMasks = getAliasesWithUpdatedMetadata(
          localCopyOfServerMasks,
          localMasks
        );
      }

      browser.storage.local.set({ relayAddresses: localCopyOfServerMasks });
    } else {
      const { relayAddresses: existingLocalStorageRelayAddresses } = await browser.storage.local.get(
        "relayAddresses"
      );
      if (!existingLocalStorageRelayAddresses || existingLocalStorageRelayAddresses.length === 0) {
        await refreshLocalLabelCache({ fetchCustomMasks: isPremiumUser });
      }
    }

    document.querySelector(
      "firefox-private-relay-addon"
    ).addEventListener("website", async (event) => {
      if (event.detail.type === "labelUpdate") {
        const existingAddresses = (await browser.storage.local.get("relayAddresses")).relayAddresses;
        const update = event.detail;
        const oldAddress = existingAddresses.find(existingAddress =>
          existingAddress.id === update.alias.id &&
          existingAddress.address === update.alias.address &&
          existingAddress.domain === update.alias.domain
        );
        const newAddresses = existingAddresses.filter(existingAddress => existingAddress !== oldAddress);
        newAddresses.push({
          ...oldAddress,
          description: update.newLabel,
        });
        await browser.storage.local.set({ relayAddresses: newAddresses });
      }

      if (event.detail.type === "aliasListUpdate") {
        await refreshLocalLabelCache({ fetchCustomMasks: isPremiumUser });
      }

      if (event.detail.type === "subdomainClaimed") {
        browser.storage.local.set({
          premiumSubdomainSet: event.detail.subdomain ?? "None",
        });
      }
    });

    await browser.runtime.sendMessage({
      method: "updateAddOnAuthStatus",
      status: true,
    });
    await browser.runtime.sendMessage({
      method: "rebuildContextMenuUpgrade",
    });
  }
})();
