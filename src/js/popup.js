function getOnboardingPanels() {
  return {
    "panel1": {
      "imgSrc": "tip1-icon.svg",
      "tipHeadline": browser.i18n.getMessage("popupSignUpPanelWelcome"),
      "tipBody": browser.i18n.getMessage("popupOnboardingPanel1Body"),
    },
    "panel2": {
      "imgSrc": "tip2-icon.svg",
      "tipHeadline": browser.i18n.getMessage("popupOnboardingPanel2Headline"),
      "tipBody": browser.i18n.getMessage("popupOnboardingPanel2Body"),
    },
    "panel3": {
      "imgSrc": "tip3-icon.svg",
      "tipHeadline": browser.i18n.getMessage("popupOnboardingPanel3Headline"),
      "tipBody": browser.i18n.getMessage("popupOnboardingPanel3Body"),
    },
    "maxAliasesPanel": {
      "imgSrc": "high-five.svg",
      "tipHeadline": browser.i18n.getMessage("popupOnboardingMaxAliasesPanelHeadline"),
      "tipBody": browser.i18n.getMessage("popupOnboardingMaxAliasesPanelBody"),
    },
    "premiumPanel": {
      "registerDomainButton": browser.i18n.getMessage("popupRegisterDomainButton"),
      "registerDomainImg": "/images/panel-images/email-domain-illustration.svg",
    },
  };
}


function showSignUpPanel() {
  const signUpOrInPanel = document.querySelector(".sign-up-panel");
  document.body.classList.add("sign-up");
  return signUpOrInPanel.classList.remove("hidden");
}

function choosePanel(numRemaining, panelId, premium){
  if (premium){
    document.getElementsByClassName("content-wrapper")[0].remove();
    return 'premiumPanel';
  }
  else {
    document.getElementsByClassName("premium-wrapper")[0].remove();
    return (numRemaining === 0) ? "maxAliasesPanel" : `panel${panelId}`
  }
}

async function showRelayPanel(tipPanelToShow) {
  const premiumPanelWrapper = document.querySelector(".premium-wrapper");
  const onboardingPanelWrapper = document.querySelector("onboarding-panel");
  const tipImageEl = onboardingPanelWrapper.querySelector("img");
  const tipHeadlineEl = onboardingPanelWrapper.querySelector("h1");
  const tipBodyEl = onboardingPanelWrapper.querySelector("p");
  const currentPanel = onboardingPanelWrapper.querySelector(".current-panel");
  const onboardingPanelStrings = getOnboardingPanels();

  const aliasesUsedValEl = premiumPanelWrapper.querySelector(".aliases-used");
  const emailsBlockedValEl = premiumPanelWrapper.querySelector(".emails-forwarded");
  const emailsForwardedValEl = premiumPanelWrapper.querySelector(".emails-blocked");

  //Premium Panel
  const registerDomainButtonEl = premiumPanelWrapper.querySelector(".register-domain-cta");
  const registerDomainImgEl = premiumPanelWrapper.querySelector(".email-domain-illustration");

  const { premium } = await browser.storage.local.get("premium");

  const updatePanel = (numRemaining, panelId) => {
    const panelToShow = choosePanel(numRemaining, panelId, premium);
    onboardingPanelWrapper.classList = [panelToShow];
    const panelStrings = onboardingPanelStrings[`${panelToShow}`];

    registerDomainButtonEl.textContent = panelStrings.registerDomainButton;
    tipImageEl.src = `/images/panel-images/${panelStrings.imgSrc}`;

    tipHeadlineEl.textContent = panelStrings.tipHeadline;
    tipBodyEl.textContent = panelStrings.tipBody;
    currentPanel.textContent = `${panelId}`;

    //Premium Panel
    aliasesUsedValEl.textContent = aliasesUsedVal;
    emailsBlockedValEl.textContent = emailsBlockedVal;
    emailsForwardedValEl.textContent = emailsForwardedVal;
    registerDomainImgEl.src = panelStrings.registerDomainImg;

    return;
  };

  //Dashboard Data
  const { aliasesUsedVal } = await browser.storage.local.get("aliasesUsedVal");
  const { emailsForwardedVal } = await browser.storage.local.get("emailsForwardedVal");
  const { emailsBlockedVal } = await browser.storage.local.get("emailsBlockedVal");

  //Remaining aliases
  const { relayAddresses, maxNumAliases } = await getRemainingAliases();
  const numRemaining = maxNumAliases - relayAddresses.length;
  const remainingAliasMessage = document.querySelector(".aliases-remaining");
  remainingAliasMessage.textContent = browser.i18n.getMessage("popupRemainingAliases", [numRemaining, maxNumAliases]);

  document.body.classList.add("relay-panel");
  updatePanel(numRemaining, tipPanelToShow);

  //Carousel
  document.querySelectorAll(".panel-nav").forEach(navBtn => {
    navBtn.addEventListener("click", () => {
      sendRelayEvent("Panel", "click", "panel-navigation-arrow");
      // pointer events are disabled in popup CSS for the "previous" button on panel 1
      // and the "next" button on panel 3
      const nextPanel = (navBtn.dataset.direction === "-1") ? -1 : 1;
      return updatePanel(numRemaining, tipPanelToShow+=nextPanel);
    });
  });

  const relayPanel = document.querySelector(".signed-in-panel");
  relayPanel.classList.remove("hidden");

  if (numRemaining === 0) {
    return sendRelayEvent("Panel", "viewed-panel", "panel-max-aliases");
  }
  return sendRelayEvent("Panel","viewed-panel", "authenticated-user-panel");
}


async function getAllAliases() {
  return await browser.storage.local.get("relayAddresses");
}


async function getRemainingAliases() {
  const { relayAddresses } = await getAllAliases();
  const { maxNumAliases } = await browser.storage.local.get("maxNumAliases");
  return { relayAddresses, maxNumAliases };
}


async function getDashboardData() {
  const { aliasesUsedVal } = await browser.storage.local.get("aliasesUsedVal");
  const { emailsForwardedVal } = await browser.storage.local.get("emailsForwardedVal");
  const { emailsBlockedVal } = await browser.storage.local.get("emailsBlockedVal");
  return { aliasesUsedVal, emailsForwardedVal, emailsBlockedVal };
}


function enableSettingsPanel() {
  const settingsToggles = document.querySelectorAll(".settings-toggle");
  settingsToggles.forEach(toggle => {
    toggle.addEventListener("click", () => {
      document.body.classList.toggle("show-settings");
      const eventLabel = document.body.classList.contains("show-settings") ? "opened-settings" : "closed-settings";
      if (document.body.classList.contains("show-settings")) {
        sendRelayEvent("Panel", "click", eventLabel);
      }
    });
  });
}


async function enableInputIconDisabling() {
  const inputIconVisibilityToggle = document.querySelector(".toggle-icon-in-page-visibility");

  const stylePrefToggle = (inputsEnabled) => {
    if (inputsEnabled === "show-input-icons") {
      inputIconVisibilityToggle.dataset.iconVisibilityOption = "disable-input-icon";
      inputIconVisibilityToggle.classList.remove("input-icons-disabled");
      return;
    }
    inputIconVisibilityToggle.dataset.iconVisibilityOption = "enable-input-icon";
    inputIconVisibilityToggle.classList.add("input-icons-disabled");
  };


  const iconsAreEnabled = await areInputIconsEnabled();
  const userIconChoice = iconsAreEnabled ? "show-input-icons" : "hide-input-icons";
  stylePrefToggle(userIconChoice);

  inputIconVisibilityToggle.addEventListener("click", async() => {
    const userIconPreference = (inputIconVisibilityToggle.dataset.iconVisibilityOption === "disable-input-icon") ? "hide-input-icons" : "show-input-icons";
    await browser.runtime.sendMessage({
      method: "updateInputIconPref",
      iconPref: userIconPreference,
    });
    sendRelayEvent("Panel", "click", userIconPreference);
    return stylePrefToggle(userIconPreference);
  });

}


async function popup() {
  sendRelayEvent("Panel", "opened-panel", "any-panel");
  const userApiToken = await browser.storage.local.get("apiToken");
  const signedInUser = (userApiToken.hasOwnProperty("apiToken"));
  if (!signedInUser) {
    sendRelayEvent("Panel", "viewed-panel", "unauthenticated-user-panel");
    showSignUpPanel();
  }

  if (signedInUser) {
    showRelayPanel(1);
  }

  enableSettingsPanel();
  enableDataOptOut();
  enableInputIconDisabling();

  document.querySelectorAll(".close-popup-after-click").forEach(el => {
    el.addEventListener("click", async (e) => {
      e.preventDefault();
      if (e.target.dataset.eventLabel && e.target.dataset.eventAction) {
        sendRelayEvent("Panel", e.target.dataset.eventAction, e.target.dataset.eventLabel);
      }
      await browser.tabs.create({ url: el.href });
      window.close();
    });
  });

  const { relaySiteOrigin } = await browser.storage.local.get("relaySiteOrigin");

  document.querySelectorAll(".login-link").forEach(loginLink => {
    loginLink.href = `${relaySiteOrigin}/accounts/profile?utm_source=fx-relay-addon&utm_medium=popup&utm_content=popup-continue-btn`;
  });

  document.querySelectorAll(".register-domain-cta").forEach(registerDomainLink => {
    registerDomainLink.href = `${relaySiteOrigin}/accounts/profile`;
  });

  document.querySelectorAll(".dashboard-link").forEach(dashboardLink => {
    dashboardLink.href = `${relaySiteOrigin}/accounts/profile?utm_source=fx-relay-addon&utm_medium=popup&utm_content=manage-relay-addresses`;
  });
}

document.addEventListener("DOMContentLoaded", popup);
