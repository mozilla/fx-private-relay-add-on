(async function () {
  // Get the api token from the account profile page
  const profileMainElement = document.querySelector("#profile-main");
  const apiToken = profileMainElement.dataset.apiToken;
  browser.storage.local.set({ apiToken });

  // API URL is ${RELAY_SITE_ORIGIN}/api/v1/
  const { relayApiSource } = await browser.storage.local.get("relayApiSource");

  const apiProfileURL = `${relayApiSource}/profiles/`;
  const apiRelayAddressesURL = `${relayApiSource}/relayaddresses/`;

  async function apiRequest(url) {
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

    const headers = new Headers(undefined);

    // headers.set("X-CSRFToken", csrfCookieValue);
    headers.set("Content-Type", "application/json");
    headers.set("Accept", "application/json");

    const response = await fetch(url, {
      mode: "same-origin",
      method: "GET",
      headers: headers,
    });

    answer = await response.json();

    return answer;
  }

  const serverProfileData = await apiRequest(apiProfileURL);

  browser.storage.local.set({
    profileID: parseInt(serverProfileData[0].id, 10),
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
  const isPremiumUser = document
    .querySelector("body")
    .classList.contains("is-premium");
  browser.storage.local.set({ premium: isPremiumUser });

  // Loop over the addresses on the page
  const dashboardRelayAliasCards = document.querySelectorAll(
    "[data-relay-address]"
  );
  const relayAddresses = [];

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
  const premiumEnabled = document.querySelector(
    "firefox-private-relay-addon-data"
  ).dataset.premiumEnabled;
  browser.storage.local.set({
    fxaSubscriptionsUrl,
    premiumProdId,
    premiumPriceId,
    aliasesUsedVal,
    emailsForwardedVal,
    emailsBlockedVal,
    premiumSubdomainSet,
    premiumEnabled,
  });

  function mergeLocalStorageDataWithServer(localAliases, serverAliases) {
    // TODO: Function that compares fields between both data sets and description/siteOrigin if existing in local
    // TODO: Add loop with local labels pushed to server via PATCH request

    const map = new Map();
    localAliases.forEach((alias) => map.set(alias.id, alias));
    serverAliases.forEach((alias) =>
      map.set(alias.id, { ...map.get(alias.id), ...alias })
    );

    return Array.from(map.values());
  }

  if (siteStorageEnabled) {
    const serverRelayAddresses = await apiRequest(apiRelayAddressesURL);

    // console.log("Fetch Profile Data from API");

    // let usage: This data may be overwritten when merging the
    // local storage items with the items pulled from the server.
    let localStorageData = serverRelayAddresses;

    // Check/cache local storage
    const { relayAddresses } = await browser.storage.local.get(
      "relayAddresses"
    );

    if (relayAddresses && relayAddresses.length > 0) {
      // console.log("User is pulling from server but has local storage items");
      // localStorageData = mergeLocalStorageDataWithServer(
      //   relayAddresses,
      //   getRelayAliasesFromDatabase
      // );
    }

    browser.storage.local.set({ relayAddresses: localStorageData });
  } else {
    // console.log("Scrape alias data from Profile page (Local)");

    const { relayAddresses } = await browser.storage.local.get(
      "relayAddresses"
    );

    // if (relayAddresses && relayAddresses.length > 0) {
    //   console.log("User is scraping local but has previously set labels");
    //   // TODO: Function that sets
    // }

    // Scrape data from /accounts/profile/ page
    for (const aliasCard of dashboardRelayAliasCards) {
      // Add the description (previoulsy domain) note from the addon storage to the page

      const aliasCardData = aliasCard.dataset;
      const aliasId = parseInt(aliasCardData.relayAddressId);
      const addonRelayAddress = addonRelayAddresses.relayAddresses.filter(
        (address) => address.id == aliasId
      )[0];

      const defaultAliasLabelText = browser.i18n.getMessage(
        "profilePageDefaulAliasLabelText"
      );

      // The Number.isInteger check confirms that this field was set by the add-on/user, rather than the server
      const storedLegacyAliasLabel =
        addonRelayAddress &&
        addonRelayAddress.hasOwnProperty("domain") &&
        !Number.isInteger(addonRelayAddress.domain);

      const storedAliasLabel =
        addonRelayAddress && addonRelayAddress.hasOwnProperty("description")
          ? addonRelayAddress.description
          : "";

      // Cache the siteOrigin alias attribute when updating local storage data.
      // Note that this data attribute only exists in aliases generated through the add-on
      const storedAliasSiteOrigin = addonRelayAddress?.siteOrigin ?? "";

      if (storedLegacyAliasLabel) {
        // TODO: Map current legacy domain item to new description field
        // console.log("Alias has legacy label data field");
      }

      const aliasLabelForm = aliasCard.querySelector(
        "form.relay-email-address-label-form"
      );
      const aliasLabelInput = aliasCard.querySelector(
        "input.relay-email-address-label"
      );
      const aliasLabelWrapper = (aliasLabelForm ?? aliasLabelInput)
        .parentElement;
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
        const newErrorMessage =
          badCharactersInValue.length === 1
            ? `${badCharactersInValue} is not an allowed character`
            : `${badCharactersInValue.join(" ")} are not allowed characters`;
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
        const updatedRelayAddress = relayAddresses.filter(
          (address) => address.id == aliasId
        )[0];
        updatedRelayAddress.description = newAliasLabel;
        browser.storage.local.set({ relayAddresses });

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
      aliasLabelInput.addEventListener("focusout", saveAliasLabel);
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
        // domain: storedAliasLabel,
        description: storedAliasLabel,
        siteOrigin: storedAliasSiteOrigin,
      };

      relayAddresses.push(relayAddress);
    }

    browser.storage.local.set({ relayAddresses });
  }

  await browser.runtime.sendMessage({
    method: "rebuildContextMenuUpgrade",
  });
})();
