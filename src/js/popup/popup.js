function getOnboardingPanels() {
  return {
    "panel1": {
      "imgSrc": "announcements/panel-announcement-critical-emails.svg",
      "tipHeadline": browser.i18n.getMessage("popupBlockPromotionalEmailsHeadline_2"),
      "tipBody": browser.i18n.getMessage("popupBlockPromotionalEmailsBodyNonPremium"),
    },
    "panel2": {
      "imgSrc": "announcements/panel-announcement-sign-back-in.svg",
      "tipHeadline": browser.i18n.getMessage("popupSignBackInHeadline_mask"),
      "tipBody": browser.i18n.getMessage("popupSignBackInBody_mask_v2"),
    },
    "maxAliasesPanel": {
      "imgSrc": "high-five.svg",
      "tipHeadline": browser.i18n.getMessage("popupOnboardingMaxAliasesPanelHeadline"),
      "tipBody": browser.i18n.getMessage("popupOnboardingMaxAliasesPanelBody"),
      "upgradeButton": browser.i18n.getMessage("popupUpgradeToPremiumBanner"),
      "upgradeButtonIcon": "/icons/icon.svg",
    },
    "premiumPanel": {
      "registerDomainButton": browser.i18n.getMessage("popupRegisterDomainButton_mask"),
      "registerDomainHeadline": browser.i18n.getMessage("popupRegisterDomainHeadline_mask"),
      "registerDomainImg": "/images/panel-images/email-domain-illustration.svg",
      "aliasesUsedText": browser.i18n.getMessage("popupAliasesUsed_mask"),
      "emailsBlockedText": browser.i18n.getMessage("popupEmailsBlocked"),
      "emailsForwardedText": browser.i18n.getMessage("popupEmailsForwarded"),
    }
  };
}

function getEducationalStrings() {
  return {
    "educationalComponent1": {
      "img": "/images/panel-images/educational-matrix/educationalImg1.png",
      "headline": browser.i18n.getMessage("popupEducationalComponent1Headline"),
      "description": browser.i18n.getMessage("popupEducationalComponent1Body"),
    },
    "educationalAttachmentSizeLimit": {
      "img": "/images/panel-images/educational-matrix/educationalImg-attachment-limit.svg",
      "headline": browser.i18n.getMessage("popupAttachmentSizeIncreaseHeadline"),
      "description": browser.i18n.getMessage("popupAttachmentSizeIncreaseBody"),
    },
    "educationalCriticalEmails": {
      "img": "/images/panel-images/educational-matrix/educationalImg-block-emails.svg",
      "headline": browser.i18n.getMessage("popupBlockPromotionalEmailsHeadline_2"),
      "description": browser.i18n.getMessage("popupBlockPromotionalEmailsBody_mask"),
    },
    "educationalSignBackIn": {
      "img": "/images/panel-images/educational-matrix/educationalImg-sign-back-in.svg",
      "headline": browser.i18n.getMessage("popupSignBackInHeadline_mask"),
      "description": browser.i18n.getMessage("popupSignBackInBody_mask_v2"),
    }
  };
}

function showSignUpPanel() {
  const signUpOrInPanel = document.querySelector(".sign-up-panel");
  document.body.classList.add("sign-up");
  return signUpOrInPanel.classList.remove("hidden");
}

const serverStoragePanel = {
  isRelevant: async () => {
    const { serverStoragePrompt } = await browser.storage.local.get(
      "serverStoragePrompt"
    );

    const serverStoragePref = await browser.runtime.sendMessage({
      method: "getServerStoragePref"
    });

    // TODO: Check when user was created

    // Only show the server prompt panel the user has not already opt'd in,
    // or if they have not interacted with the panel before.
    if (!serverStoragePref && !serverStoragePrompt) {
      return true;
    }

    return false;
  },
  hide: () => {
    const serverStoragePanelWrapper = document.querySelector(
      ".js-server-storage-wrapper"
    );

    document.querySelectorAll(".content-wrapper").forEach((div) => {
      div.classList.remove("is-hidden");
    });

    serverStoragePanelWrapper.classList.add("is-hidden");
    serverStoragePanelWrapper
      .querySelectorAll(".is-hidden")
      .forEach((childDiv) => childDiv.classList.add("is-hidden"));
  },
  init: (premium) => {
    // Server Storage Prompt Panel
    const serverStoragePanelWrapper = document.querySelector(
      ".js-server-storage-wrapper"
    );

    if (premium) {
      const panelStatus = document.querySelector(".panel-status");
      panelStatus.classList.add("is-hidden");
    }

    document.querySelectorAll(".content-wrapper").forEach((div) => {
      div.classList.add("is-hidden");
    });

    serverStoragePanelWrapper.classList.remove("is-hidden");

    serverStoragePanelWrapper
      .querySelectorAll(".is-hidden")
      .forEach((childDiv) => childDiv.classList.remove("is-hidden"));

    const serverStoragePanelButtonDismiss =
      serverStoragePanelWrapper.querySelector(".js-button-dismiss");

    const serverStoragePanelButtonAllow =
      serverStoragePanelWrapper.querySelector(".js-button-allow");

    serverStoragePanelButtonDismiss.addEventListener(
      "click",
      serverStoragePanel.event.dismiss,
      false
    );

    serverStoragePanelButtonAllow.addEventListener(
      "click",
      serverStoragePanel.event.allow,
      false
    );
  },
  event: {
    dismiss: async (e) => {
      e.preventDefault();
      serverStoragePanel.event.dontShowPanelAgain();
      serverStoragePanel.hide();
      showRelayPanel(1);
    },

    allow: async (e) => {
      e.preventDefault();

      const { relaySiteOrigin } = await browser.storage.local.get(
        "relaySiteOrigin"
      );

      serverStoragePanel.event.dontShowPanelAgain();

      browser.tabs.create({
        url: `${relaySiteOrigin}/accounts/profile/?utm_source=fx-relay-addon&utm_medium=popup&utm_content=allow-labels-sync#sync-labels`,
        active: true,
      });

      window.close();
    },

    dontShowPanelAgain: () => {
      browser.storage.local.set({ serverStoragePrompt: true });
    }
  },
};

async function choosePanel(numRemaining, panelId, premium, premiumSubdomainSet) {
  const premiumPanelWrapper = document.querySelector(".premium-wrapper");

  // Turned off label sync prompt for premium release
  // const shouldShowServerStoragePromptPanel = await serverStoragePanel.isRelevant();
  // if (shouldShowServerStoragePromptPanel) {
  //   serverStoragePanel.init(premium);
  // } else 
  if (premium) {
    document.getElementsByClassName("content-wrapper")[0].remove();
    premiumPanelWrapper.classList.remove("is-hidden");
    premiumPanelWrapper
      .querySelectorAll(".is-hidden")
      .forEach((premiumFeature) =>
        premiumFeature.classList.remove("is-hidden")
      );
    //Toggle register domain or education module
    checkUserSubdomain(premiumSubdomainSet);
    return "premiumPanel";
  } else {
    const premiumWrapper = document.getElementsByClassName("premium-wrapper");
    if (premiumWrapper.length) {
      premiumWrapper[0].remove();
    }
    return numRemaining === 0 ? "maxAliasesPanel" : `panel${panelId}`;
  }
}

function checkUserSubdomain(premiumSubdomainSet) {
  const educationalComponent = document.querySelector(".educational-component");
  const registerDomainComponent = document.querySelector(".register-domain-component");

  if (premiumSubdomainSet != "None") {
    registerDomainComponent.classList.add("is-hidden");
  }

  else {
    educationalComponent.classList.add("is-hidden");
  }
}

async function showRelayPanel(tipPanelToShow) {
  const onboardingPanelWrapper = document.querySelector("onboarding-panel");
  const tipImageEl = onboardingPanelWrapper.querySelector("img");
  const tipHeadlineEl = onboardingPanelWrapper.querySelector("h1");
  const tipBodyEl = onboardingPanelWrapper.querySelector("p");
  const currentPanel = onboardingPanelWrapper.querySelector(".current-panel");
  const upgradeButtonEl = onboardingPanelWrapper.querySelector(".upgrade-banner");
  const upgradeButtonIconEl = onboardingPanelWrapper.querySelector(".upgrade-banner-icon");
  const panelPagination = onboardingPanelWrapper.querySelector(".onboarding-pagination");
  const onboardingPanelStrings = getOnboardingPanels();
  const educationalStrings = getEducationalStrings();

  document.querySelectorAll(".total-panels").forEach(panel => {
    panel.textContent = 2;
  });

  if (!browser.menus) {
    // Remove sign back in for browsers that don't support menus API (Chrome)
    delete onboardingPanelStrings.panel2;
    panelPagination.classList.add("is-hidden");
    // document.querySelectorAll(".total-panels").forEach(panel => {
    //   panel.textContent = 1;
    // });
  }

  //Premium Panel
  const premiumPanelWrapper = document.querySelector(".premium-wrapper");
  const registerDomainImgEl = premiumPanelWrapper.querySelector(".email-domain-illustration");
  const aliasesUsedValEl = premiumPanelWrapper.querySelector(".aliases-used");
  const emailsBlockedValEl = premiumPanelWrapper.querySelector(".emails-blocked");
  const emailsForwardedValEl = premiumPanelWrapper.querySelector(".emails-forwarded");

  //Check if premium features are available
  const premiumCountryAvailability = (await browser.storage.local.get("premiumCountries"))?.premiumCountries;

  //Check if user is premium
  const { premium } = await browser.storage.local.get("premium");

  //Check if user has a subdomain set
  const { premiumSubdomainSet } = await browser.storage.local.get("premiumSubdomainSet");

  //Educational Panel
  const educationalModule = premiumPanelWrapper.querySelector(".educational-component");
  const educationalImgEl = premiumPanelWrapper.querySelector(".education-img");
  const attachmentSizeLimitHeadline = premiumPanelWrapper.querySelector(".education-headline");
  const attachmentSizeLimitBody = premiumPanelWrapper.querySelector(".education-body");
  const currentEducationalPanel = premiumPanelWrapper.querySelector(".current-panel");
  const panelPremiumPagination = educationalModule.querySelector(".onboarding-pagination");

  //Load first announcement item
  const educationStringsSelection = educationalStrings["educationalCriticalEmails"];
  const educationalComponentStrings = educationStringsSelection;
  attachmentSizeLimitHeadline.textContent = educationalComponentStrings.headline;
  attachmentSizeLimitBody.textContent = educationalComponentStrings.description;
  educationalImgEl.src = educationalComponentStrings.img;
  currentEducationalPanel.textContent = `${tipPanelToShow}`;
  educationalModule.setAttribute("id", "educationalCriticalEmails");

  if (!browser.menus) {
    panelPremiumPagination.classList.add("hidden");
  }

  const updateEducationPanel = async (announcementIndex) => {
    currentEducationalPanel.textContent = [`${tipPanelToShow}`];
    if (announcementIndex === 1) {
      switchEducationPanel("educationalCriticalEmails");
      // educationalModule.classList.remove("is-last-panel");

      if (!browser.menus) {
        // Override class for Chrome browsers to not display sign-back in
        educationalModule.classList.add("is-last-panel");
      }
    }

    if (announcementIndex === 2) {
      switchEducationPanel("educationalSignBackIn");

    }

    // if (announcementIndex === 3) {
    //   switchEducationPanel("educationalSignBackIn");
    // }
  }

  function switchEducationPanel(announcementType) {
    const updateEducationPanel = educationalStrings[announcementType];
    attachmentSizeLimitHeadline.textContent = updateEducationPanel.headline;
    attachmentSizeLimitBody.textContent = updateEducationPanel.description;
    educationalImgEl.src = updateEducationPanel.img;
    educationalModule.setAttribute("id", announcementType);
  }

  const updatePanel = async (numRemaining, panelId) => {
    const panelToShow = await choosePanel(numRemaining, panelId, premium, premiumSubdomainSet);
    onboardingPanelWrapper.classList = [panelToShow];


    // Override class for Chrome browsers to not display sign-back in
    if (!browser.menus && (panelId === 2)) {
      onboardingPanelWrapper.classList.add("is-last-panel")
    }

    const panelStrings = onboardingPanelStrings[`${panelToShow}`];

    if (!panelStrings) {
      // Exit early if on a non-onboarding
      return;
    }

    tipImageEl.src = `/images/panel-images/${panelStrings.imgSrc}`;
    tipHeadlineEl.textContent = panelStrings.tipHeadline;
    tipBodyEl.textContent = panelStrings.tipBody;
    currentPanel.textContent = `${panelId}`;
    upgradeButtonEl.textContent = panelStrings.upgradeButton;
    upgradeButtonIconEl.src = panelStrings.upgradeButtonIcon;

    //Premium Panel content
    registerDomainImgEl.src = panelStrings.registerDomainImg;
    aliasesUsedValEl.textContent = aliasesUsedVal;
    emailsBlockedValEl.textContent = emailsBlockedVal;
    emailsForwardedValEl.textContent = emailsForwardedVal;


    //If Premium features are not available, do not show upgrade CTA on the panel
    if (premiumCountryAvailability?.premium_available_in_country === true) {
      const premiumCTA = document.querySelector(".premium-cta");
      premiumCTA.classList.remove("is-hidden");
    }

    // Remove panel status if user has unlimited aliases, so no negative alias left count
    if (premium) {
      const panelStatus = document.querySelector(".panel-status");
      panelStatus.classList.add("is-hidden");
    }

    return;
  };

  //Dashboard Data
  const { aliasesUsedVal } = await browser.storage.local.get("aliasesUsedVal");
  const { emailsForwardedVal } = await browser.storage.local.get("emailsForwardedVal");
  const { emailsBlockedVal } = await browser.storage.local.get("emailsBlockedVal");


  //Nonpremium panel status 
  const { relayAddresses, maxNumAliases } = await getRemainingAliases();
  const numRemaining = maxNumAliases - relayAddresses.length;
  const remainingAliasMessage = document.querySelector(".aliases-remaining");
  remainingAliasMessage.textContent = browser.i18n.getMessage("popupRemainingAliases_2_mask", [numRemaining, maxNumAliases]);
  const getUnlimitedAliases = document.querySelector(".premium-cta");
  getUnlimitedAliases.textContent = browser.i18n.getMessage("popupGetUnlimitedAliases_mask");

  document.body.classList.add("relay-panel");
  updatePanel(numRemaining, tipPanelToShow);

  document.querySelectorAll(".panel-nav").forEach(navBtn => {
    navBtn.addEventListener("click", () => {
      sendRelayEvent("Panel", "click", "panel-navigation-arrow");
      // pointer events are disabled in popup CSS for the "previous" button on panel 1
      // and the "next" button on panel 3
      const nextPanel = (navBtn.dataset.direction === "-1") ? -1 : 1;
      return updatePanel(numRemaining, tipPanelToShow += nextPanel);
    });
  });

  document.querySelectorAll(".js-panel-nav").forEach(navBtn => {
    navBtn.addEventListener("click", () => {
      sendRelayEvent("Panel", "click", "panel-navigation-arrow");
      // pointer events are disabled in popup CSS for the "previous" button on panel 1
      // and the "next" button on panel 3
      const nextPanel = (navBtn.dataset.direction === "-1") ? -1 : 1;
      updateEducationPanel(tipPanelToShow += nextPanel);
    });
  });

  if (premium) {
    remainingAliasMessage.classList.add("is-hidden");
  }

  if (premiumCountryAvailability?.premium_available_in_country === true) {
    getUnlimitedAliases.classList.remove("is-hidden");
  }

  const relayPanel = document.querySelector(".signed-in-panel");
  relayPanel.classList.remove("hidden");

  if (numRemaining === 0) {

    if (premiumCountryAvailability?.premium_available_in_country === true) {
      const upgradeButton = document.querySelector(".upgrade-banner-wrapper");
      upgradeButton.classList.remove("is-hidden");
    }

    return sendRelayEvent("Panel", "viewed-panel", "panel-max-aliases");
  }
  return sendRelayEvent("Panel", "viewed-panel", "authenticated-user-panel");
}


async function getAllAliases() {
  return await browser.storage.local.get("relayAddresses");
}


async function getRemainingAliases() {
  const { relayAddresses } = await getAllAliases();
  const { maxNumAliases } = await browser.storage.local.get("maxNumAliases");
  return { relayAddresses, maxNumAliases };
}

async function getBrowser() {
  if (typeof browser.runtime.getBrowserInfo === "function") {
    /** @type {{ name: string, vendor: string, version: string, buildID: string }} */
    const browserInfo = await browser.runtime.getBrowserInfo();
    return browserInfo.name;
  }
  if (navigator.userAgent.toLowerCase().indexOf("firefox") !== -1) {
    return "Firefox";
  }
  return "Chrome";
}

async function enableSettingsPanel() {

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

  const currentBrowser = await getBrowser();

  if (currentBrowser === "Chrome") {
    const supportLink = document.getElementById("popupSettingsLeaveFeedbackLink");
    const chromeSupportLink = "https://chrome.google.com/webstore/detail/firefox-relay/lknpoadjjkjcmjhbjpcljdednccbldeb/?utm_source=fx-relay-addon&utm_medium=popup"
    supportLink.href = chromeSupportLink;
  }
}

async function enableReportIssuePanel() {
  const reportIssueToggle = document.querySelector(".settings-report-issue");
  const reportIssueSettingsReturn = document.querySelector(".settings-report-issue-return");
  const submissionSuccessContinue = document.querySelector(".report-continue");

  [reportIssueToggle, reportIssueSettingsReturn, submissionSuccessContinue].forEach(e => {
    e.addEventListener("click", () => {
      document.body.classList.toggle("show-report-issue");
      const eventLabel = document.body.classList.contains("show-report-issue") ? "opened-report-issue" : "closed-report-issue";
      if (document.body.classList.contains("show-report-issue")) {
        sendRelayEvent("Panel", "click", eventLabel);
      }
    });
  });


  reportURL();
  showReportInputOtherTextField();
  showSuccessReportSubmission();

  const reportForm = document.querySelector(".report-issue-content");
  reportForm.addEventListener('submit', handleReportIssueFormSubmission);
}

function handleReportIssueFormSubmission(event) {
  event.preventDefault();
  const data = new FormData(event.target);
  const formJSON = Object.fromEntries(data.entries());
  console.log(JSON.stringify(formJSON, null, 2));
}

async function showSuccessReportSubmission() {
  const reportIssueSubmitBtn = document.querySelector(".report-issue-submit-btn");
  const reportSuccess = document.querySelector(".report-success");
  const reportContent = document.querySelector(".report-issue-content");

  reportIssueSubmitBtn.addEventListener("click", () => {
    reportSuccess.classList.remove("is-hidden");
    reportContent.classList.add("is-hidden");

  });
}

async function reportURL() {
  // Add Site URL placeholder
  const currentPage = await getCurrentPage();
  const url = new URL(currentPage.url);
  const inputFieldUrl = document.querySelector('input[name="report-website"]');
  inputFieldUrl.value = url.hostname;
}

async function showReportInputOtherTextField() {
  const otherCheckbox = document.querySelector('input[name="issue-case-other"');
  const otherTextField = document.querySelector('input[name="issue-case-other-details"');
  otherCheckbox.addEventListener("click", () => {
    otherTextField.classList.toggle("is-hidden");
  })

  // Add placeholder to report input on 'Other' selection
  const inputFieldOtherDetails = document.querySelector('input[name="issue-case-other-details"]');

  // Clear placeholder on click
  inputFieldOtherDetails.addEventListener("click", () => {
    if (inputFieldOtherDetails.value === browser.i18n.getMessage("popupReportIssueCaseOtherDetails")) {
      inputFieldOtherDetails.value = "";
    }
  })
}

async function getCurrentPage() {
  const [currentTab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  return currentTab;
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

  inputIconVisibilityToggle.addEventListener("click", async () => {
    const userIconPreference = (inputIconVisibilityToggle.dataset.iconVisibilityOption === "disable-input-icon") ? "hide-input-icons" : "show-input-icons";
    await browser.runtime.sendMessage({
      method: "updateInputIconPref",
      iconPref: userIconPreference,
    });
    sendRelayEvent("Panel", "click", userIconPreference);
    return stylePrefToggle(userIconPreference);
  });

}

async function clearBrowserActionBadge() {
  const { browserActionBadgesClicked } = await browser.storage.local.get(
    "browserActionBadgesClicked"
  );

  // Dismiss the browserActionBadge only when it exists
  if (browserActionBadgesClicked === false) {
    browser.storage.local.set({ browserActionBadgesClicked: true });
    browser.browserAction.setBadgeBackgroundColor({ color: null });
    browser.browserAction.setBadgeText({ text: "" });
  }
}

async function popup() {
  sendRelayEvent("Panel", "opened-panel", "any-panel");
  clearBrowserActionBadge();
  const userApiToken = await browser.storage.local.get("apiToken");
  const signedInUser = (Object.prototype.hasOwnProperty.call(userApiToken, "apiToken"));

  // Set custom fonts from the add-on
  await setCustomFonts();

  if (!signedInUser) {
    sendRelayEvent("Panel", "viewed-panel", "unauthenticated-user-panel");
    showSignUpPanel();
  }

  if (signedInUser) {
    showRelayPanel(1);
  }


  await enableSettingsPanel();
  await enableReportIssuePanel();

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

  document.querySelectorAll(".dashboard-link").forEach(dashboardLink => {
    dashboardLink.href = `${relaySiteOrigin}/accounts/profile?utm_source=fx-relay-addon&utm_medium=popup&utm_content=manage-relay-addresses`;
  });


  document.querySelectorAll(".get-premium-link").forEach(premiumLink => {
    premiumLink.href = `${relaySiteOrigin}/premium?utm_source=fx-relay-addon&utm_medium=popup&utm_content=get-premium-link`;
  });

  document.querySelectorAll(".register-domain-cta").forEach(registerDomainLink => {
    registerDomainLink.href = `${relaySiteOrigin}/accounts/profile?utm_source=fx-relay-addon&utm_medium=popup&utm_content=register-email-domain#mpp-choose-subdomain`;
  });

}

document.addEventListener("DOMContentLoaded", popup);
