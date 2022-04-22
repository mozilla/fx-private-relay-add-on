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
    browser.storage.local.set({ apiToken });

    // API URL is ${RELAY_SITE_ORIGIN}/api/v1/
    const { relayApiSource } = await browser.storage.local.get("relayApiSource");

    const apiProfileURL = `${relayApiSource}/profiles/`;
    const apiRelayAddressesURL = `${relayApiSource}/relayaddresses/`;

    async function apiRequest(url, method = "GET", body = null, opts=null) {

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

      browser.storage.local.set({ csrfCookieValue: csrfCookieValue });


      const headers = new Headers();


      headers.set("X-CSRFToken", csrfCookieValue);
      headers.set("Content-Type", "application/json");
      headers.set("Accept", "application/json");

      if (opts && opts.auth) {
        const apiToken = await browser.storage.local.get("apiToken");
        headers.set("Authorization", `Token ${apiToken.apiToken}`);
      }


      const response = await fetch(url, {
        mode: "same-origin",
        method,
        headers: headers,
        body,
      });

      const answer = await response.json();
      return answer;
    }

    const serverProfileData = await apiRequest(apiProfileURL);

    browser.storage.local.set({
      profileID: parseInt(serverProfileData[0].id, 10),
      settings: {
        server_storage: serverProfileData[0].server_storage,
      },
    });

    // Get the relay address objects from the addon storage
    const addonStorageRelayAddresses = await browser.storage.local.get(
      "relayAddresses"
    );

    const siteStorageEnabled = serverProfileData[0].server_storage;

    const addonRelayAddresses =
      Object.keys(addonStorageRelayAddresses).length === 0
        ? { relayAddresses: [] }
        : addonStorageRelayAddresses;

    // Check if user is premium
    // Note: for the non-React website, we would look at the DOM for the
    //       `is-premium` class. Starting with the React-based website, the
    //       Premium status is explicitly communicated with the add-on via a
    //       data property. In other words: if the website is in React when you
    //       encounter this, the first leg of the `||` can be removed.
    const isPremiumUser = document
      .querySelector("body")
      .classList.contains("is-premium") || document.querySelector(
        "firefox-private-relay-addon-data"
      ).dataset.hasPremium === "true";
    browser.storage.local.set({ premium: isPremiumUser });

    // Loop over the addresses on the page
    const dashboardRelayAliasCards = document.querySelectorAll(
      "[data-relay-address]"
    );

    const localStorageRelayAddresses = [];

    // Get FXA Stuff
    const fxaSubscriptionsUrl = document.querySelector(
      "firefox-private-relay-addon-data"
    ).dataset.fxaSubscriptionsUrl;
    const premiumProdId = document.querySelector(
      "firefox-private-relay-addon-data"
    ).dataset.premiumProdId;
    const premiumPriceId = document.querySelector(
      "firefox-private-relay-addon-data"
    ).dataset.premiumPriceId;
    const aliasesUsedVal = document.querySelector(
      "firefox-private-relay-addon-data"
    ).dataset.aliasesUsedVal;
    const emailsForwardedVal = document.querySelector(
      "firefox-private-relay-addon-data"
    ).dataset.emailsForwardedVal;
    const emailsBlockedVal = document.querySelector(
      "firefox-private-relay-addon-data"
    ).dataset.emailsBlockedVal;
    const premiumSubdomainSet = document.querySelector(
      "firefox-private-relay-addon-data"
    ).dataset.premiumSubdomainSet;
    browser.storage.local.set({
      fxaSubscriptionsUrl,
      premiumProdId,
      premiumPriceId,
      aliasesUsedVal,
      emailsForwardedVal,
      emailsBlockedVal,
      premiumSubdomainSet,
    });

    // Loop through an array of aliases and see if any of them have descriptions or generated_for set.
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
      }
    }

    // Loop through local storage aliases and sync any metadata they have with the server dataset
    async function sendMetaDataToServer(aliases) {
      for (const alias of aliases) {
        const body = {
          description: alias.description ?? "",
          generated_for: alias.generated_for ?? "",
        };

        if (body.description.length > 0 || body.generated_for.length > 0) {
          await apiRequest(`${apiRelayAddressesURL}${alias.id}/`, "PATCH", JSON.stringify(body), {auth: true});
        }
      }
    }

    // Loop through the temp array that is about to be synced with the server dataset and
    // be sure it matches the local storage metadata dataset
    function getAliasesWithUpdatedMetadata(updatedAliases, prevAliases) {
      return prevAliases.map(prevAlias => {
        const updatedAlias = updatedAliases.find(otherAlias => otherAlias.id === prevAlias.id);
        return {
          ...prevAlias,
          description: updatedAlias.description.length > 0 ? updatedAlias.description : prevAlias.description,
          generated_for: updatedAlias.generated_for.length > 0 ? updatedAlias.generated_for : prevAlias.generated_for,
        };
      }
    )}

    if (siteStorageEnabled) {
      // Sync alias data from server page.
      // If local storage items exist AND have label metadata stored, sync it to the server.
      const serverRelayAddresses = await apiRequest(apiRelayAddressesURL);

      // let usage: This data may be overwritten when merging the local storage dataset with the server set.
      let localCopyOfServerRelayAddresses = serverRelayAddresses;

      // Check/cache local storage
      const { relayAddresses } = await browser.storage.local.get(
        "relayAddresses"
      );

      if (
        relayAddresses &&
        relayAddresses.length > 0 &&
        aliasesHaveStoredMetadata(relayAddresses) && // Make sure there is meta data in the local dataset
        !aliasesHaveStoredMetadata(localCopyOfServerRelayAddresses) // Make sure there is no meta data in the server dataset
      ) {
        await sendMetaDataToServer(relayAddresses);
        localCopyOfServerRelayAddresses = getAliasesWithUpdatedMetadata(
          localCopyOfServerRelayAddresses,
          relayAddresses
        );
      }

      browser.storage.local.set({ relayAddresses: localCopyOfServerRelayAddresses });
    } else {
      // Scrape alias data from Profile page (Local)

      // await browser.runtime.sendMessage({
      //   method: "displayBrowserActionBadge",
      // });

      // Scrape data from /accounts/profile/ page
      for (const aliasCard of dashboardRelayAliasCards) {
        // Add the description (previoulsy domain) note from the addon storage to the page

        const aliasCardData = aliasCard.dataset;
        const aliasId = parseInt(aliasCardData.relayAddressId, 10);
        const addonRelayAddress = addonRelayAddresses.relayAddresses.filter(
          (address) => address.id == aliasId
        )[0];

        const defaultAliasLabelText = browser.i18n.getMessage(
          "profilePageDefaulAliasLabelText"
        );

        // The labels (previously ONLY in local storage of the add-on) were set
        // as a string entry for "domain". With the new alias object from the server,
        // it already has an entry named "domain", which is an integer.
        // This variable checks for three truths:
        //   - Does the alias exists?
        //   - Does it have an entry for "domain"?
        //   - Is the entry NOT an integer?
        // If all three of these are true, this user has a legacy label stored locally
        // that needs to be ported to the "description" entry
        const storedLegacyAliasLabel =
          addonRelayAddress &&
          Object.prototype.hasOwnProperty.call(addonRelayAddress, "domain") &&
          !Number.isInteger(addonRelayAddress.domain);

        let storedAliasLabel =
          addonRelayAddress &&
          Object.prototype.hasOwnProperty.call(addonRelayAddress, "description")
            ? addonRelayAddress.description
            : "";

        // Cache the generated_for alias attribute when updating local storage data.
        // Note that this data attribute only exists in aliases generated through the add-on
        let storedAliasGeneratedFor = addonRelayAddress?.generated_for ?? "";

        // This covers any legacy label field and remaps them.
        if (storedLegacyAliasLabel) {
          storedAliasLabel = addonRelayAddress.domain;
        }

        // This covers any legacy siteOrigin field and remaps them.
        const storedLegacyAliasSiteOrigin = addonRelayAddress?.siteOrigin;
        if (storedLegacyAliasSiteOrigin) {
          storedAliasGeneratedFor = addonRelayAddress.generated_for;
        }

        const aliasLabelForm = aliasCard.querySelector(
          "form.relay-email-address-label-form"
        );
        const aliasLabelInput = aliasCard.querySelector(
          "input.relay-email-address-label"
        );

        const aliasLabelWrapper = aliasLabelForm.parentElement;
        aliasLabelWrapper.classList.add("show-label"); // Field is visible only to users who have the addon installed

        aliasLabelInput.dataset.label = storedAliasLabel;

        if (storedAliasLabel !== "") {
          aliasLabelInput.value = storedAliasLabel;
          aliasLabelWrapper.classList.add("user-created-label");
        } else {
          aliasLabelInput.placeholder = defaultAliasLabelText;
        }

        // eslint-disable-next-line quotes
        const forbiddenCharacters = `{}()=;'-<>"`;
        const showInputErrorMessage = (errorMessageContent) => {
          aliasLabelInput.classList.add("input-has-error");
          aliasLabelWrapper.querySelector(".input-error").textContent =
            errorMessageContent;
          aliasLabelWrapper.classList.add("show-input-error");
          return;
        };

        const pluralSingularErrorMessage = (badCharactersInValue) => {
          const newErrorMessage = browser.i18n.getMessage(
            "profilePageInvalidAliasCharactersError",
            Array.isArray(badCharactersInValue) ? badCharactersInValue.join(" ") : badCharactersInValue,
          );
          return newErrorMessage;
        };

        const checkValueForErrors = (inputValue) => {
          // Catch copy/paste forbidden characters
          const forbiddenCharsInLabelValue = [];
          forbiddenCharacters.split("").forEach((badChar) => {
            if (
              inputValue.includes(badChar) &&
              !forbiddenCharsInLabelValue.includes(badChar)
            ) {
              forbiddenCharsInLabelValue.push(badChar);
            }
          });
          return forbiddenCharsInLabelValue;
        };

        aliasLabelInput.addEventListener("keydown", (e) => {
          // Limit keystrokes when the input has errors
          const keyChar = e.key;
          if (aliasLabelInput.classList.contains("input-has-error")) {
            const charactersToAllowWhileInputHasError = [
              "Tab",
              "Backspace",
              "ArrowLeft",
              "ArrowRight",
            ];
            if (!charactersToAllowWhileInputHasError.includes(keyChar)) {
              e.preventDefault();
              return;
            }
          }
          // Show error message when forbidden keys are entered
          if (forbiddenCharacters.includes(keyChar)) {
            return showInputErrorMessage(
              `${keyChar} is not an allowed character`
            );
          }
        });

        aliasLabelInput.addEventListener("keyup", (e) => {
          const keyChar = e.key;
          const forbiddenCharsInValue = checkValueForErrors(
            aliasLabelInput.value
          );
          if (
            forbiddenCharsInValue.length === 0 &&
            !forbiddenCharacters.includes(keyChar)
          ) {
            aliasLabelInput.classList.remove("input-has-error");
            aliasLabelWrapper.classList.remove("show-input-error");
            return;
          }
          if (forbiddenCharsInValue.length > 0) {
            return showInputErrorMessage(
              pluralSingularErrorMessage(forbiddenCharsInValue)
            );
          }
        });

        const saveAliasLabel = () => {
          const newAliasLabel = aliasLabelInput.value;

          // Don't save labels containing forbidden characters
          if (aliasLabelInput.classList.contains("input-has-error")) {
            return;
          }

          const forbiddenCharsInValue = checkValueForErrors(newAliasLabel);
          if (forbiddenCharsInValue.length > 0) {
            return showInputErrorMessage(
              pluralSingularErrorMessage(forbiddenCharsInValue)
            );
          }

          // Don't show saved confirmation message if the label hasn't changed
          if (newAliasLabel === aliasLabelInput.dataset.label) {
            return;
          }

          // Save new alias label
          const updatedRelayAddress = localStorageRelayAddresses.filter(
            (address) => address.id == aliasId
          )[0];
          updatedRelayAddress.description = newAliasLabel;
          browser.storage.local.set({
            relayAddresses: localStorageRelayAddresses,
          });

          // show placeholder text if the label is blank
          if (aliasLabelInput.value === "") {
            aliasLabelWrapper.classList.remove("user-created-label");
            aliasLabelInput.placeholder = defaultAliasLabelText;
          } else {
            aliasLabelWrapper.classList.add("user-created-label");
            aliasLabelWrapper.classList.add("show-saved-confirmation");
          }

          aliasLabelInput.dataset.label = newAliasLabel;
          setTimeout(() => {
            aliasLabelWrapper.classList.remove("show-saved-confirmation");
          }, 1000);
        };
        aliasLabelInput.addEventListener("focusout", () => {
          const isValid = aliasLabelForm.reportValidity();
          if (isValid) {
            saveAliasLabel();
          }
        });
        aliasLabelForm?.addEventListener("submit", (event) => {
          event.preventDefault();
          saveAliasLabel();
          aliasLabelInput.blur();
        });

        // Get and store the relay addresses from the account profile page,
        // so they can be used later, even if the API endpoint is down

        const relayAddress = {
          id: aliasId,
          address: aliasCardData.relayAddress,
          description: storedAliasLabel,
          generated_for: storedAliasGeneratedFor,
        };

        localStorageRelayAddresses.push(relayAddress);
      }

      const { relayAddresses: existingLocalStorageRelayAddresses } = await browser.storage.local.get(
        "relayAddresses"
      );
      if (localStorageRelayAddresses.length === 0) {
        localStorageRelayAddresses.push(...existingLocalStorageRelayAddresses);
      }
      if (localStorageRelayAddresses.length === 0) {
        // If we weren't able to scrape alias data from the page, that means
        // the React version of the website (with a different DOM structure)
        // has been deployed. Since the React version handles local storage of
        // label data by itself, we don't need to add our own listeners,
        // and we can just fetch label data from the API.
        const serverRelayAddresses = await apiRequest(apiRelayAddressesURL);
        localStorageRelayAddresses.push(...serverRelayAddresses);
      }
      browser.storage.local.set({ relayAddresses: localStorageRelayAddresses });
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
    });

    await browser.runtime.sendMessage({
      method: "rebuildContextMenuUpgrade",
    });
  }
})();
