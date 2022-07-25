
async function checkWaffleFlag(flag) {
  const waffleFlagArray = (await browser.storage.local.get("waffleFlags")).waffleFlags.WAFFLE_FLAGS;
  for (let i of waffleFlagArray) {
    if (i[0] === flag && i[1] === true) {
      return true;
    }
  }
  return false;
 }

 
 async function getPromoPanels() {
  // TODO: Enable this when bundle pricing has been confirmed
  // const savings = "22%"; // For "Save 50%!" in the Bundle promo body
  // const getBundlePlans = (await browser.storage.local.get("bundlePlans")).bundlePlans.BUNDLE_PLANS;
  // const getBundlePrice = getBundlePlans.plan_country_lang_mapping[getBundlePlans.country_code].en.yearly.price;
  // const getBundleCurrency = getBundlePlans.plan_country_lang_mapping[getBundlePlans.country_code].en.yearly.currency
  // const userLocale = navigator.language;
  // const formattedBundlePrice = new Intl.NumberFormat(userLocale, {
  //   style: "currency",
  //   currency: getBundleCurrency,
  // }).format(getBundlePrice);

  return {
    "announcements": {
      // Phone Masking Announcement
      "panel1": {
        "imgSrc": "announcements/panel-phone-masking-announcement.svg",
        "imgSrcPremium": "announcements/premium-announcement-phone-masking.svg",
        "tipHeadline": browser.i18n.getMessage("popupPhoneMaskingPromoHeadline"),
        "longText": true,
        "tipBody": browser.i18n.getMessage("popupPhoneMaskingPromoBody"),
        "tipCta": browser.i18n.getMessage("popupPhoneMaskingPromoCTA"),
      },
      // TODO: Enable this when bundle pricing has been confirmed
      // Bundle Announcement
      //  "panel2": {
      //   "imgSrc": "announcements/panel-bundle-announcement.svg",
      //   "imgSrcPremium": "announcements/premium-announcement-bundle.svg",
      //   "tipHeadline": browser.i18n.getMessage("popupBundlePromoHeadline_2", savings),
      //   "tipBody": browser.i18n.getMessage("popupBundlePromoBodyFreePlan", [formattedBundlePrice, savings]),
      //   "tipCta": browser.i18n.getMessage("popupBundlePromoCTA"),
      // },
    },
    "premiumPanel": {
      "aliasesUsedText": browser.i18n.getMessage("popupAliasesUsed_mask"),
      "emailsBlockedText": browser.i18n.getMessage("popupEmailsBlocked"),
      "emailsForwardedText": browser.i18n.getMessage("popupEmailsForwarded"),
    }
  }
 }

 async function getOnboardingPanels() {
  return {
    "announcements": {
      "panel1": {
        "imgSrc": "announcements/panel-announcement-attachment-limit.svg",
        "tipHeadline": browser.i18n.getMessage("popupAttachmentSizeIncreaseHeadline"),
        "tipBody": browser.i18n.getMessage("popupAttachmentSizeIncreaseBody"),
      },
      "panel2": {
        "imgSrc": "announcements/panel-announcement-critical-emails.svg",
        "tipHeadline": browser.i18n.getMessage("popupBlockPromotionalEmailsHeadline_2"),
        "tipBody": browser.i18n.getMessage("popupBlockPromotionalEmailsBodyNonPremium"),
      },
      "panel3": {
        "imgSrc": "announcements/panel-announcement-sign-back-in.svg",
        "tipHeadline": browser.i18n.getMessage("popupSignBackInHeadline_mask"),
        "tipBody": browser.i18n.getMessage("popupSignBackInBody_mask_v2"),
      },
    },
    "maxAliasesPanel": {
      "imgSrc": "high-five.svg",
      "tipHeadline": browser.i18n.getMessage("popupOnboardingMaxAliasesPanelHeadline"),
      "tipBody": browser.i18n.getMessage("popupOnboardingMaxAliasesPanelBody"),
      "upgradeButton": browser.i18n.getMessage("popupUpgradeToPremiumBanner"),
      "upgradeButtonIcon": "/icons/icon.svg",
    },
    "premiumPanel": {
      "aliasesUsedText": browser.i18n.getMessage("popupAliasesUsed_mask"),
      "emailsBlockedText": browser.i18n.getMessage("popupEmailsBlocked"),
      "emailsForwardedText": browser.i18n.getMessage("popupEmailsForwarded"),
    }
  };
}

function getEducationalStrings() {
  return {
    "announcements": {
      "panel1": {
        "imgSrcPremium": "/educational-matrix/educationalImg1.png",
        "tipHeadline": browser.i18n.getMessage("popupEducationalComponent1Headline"),
        "tipBody": browser.i18n.getMessage("popupEducationalComponent1Body"),
      },
      "panel2": {
        "imgSrcPremium": "/educational-matrix/educationalImg-attachment-limit.svg",
        "tipHeadline": browser.i18n.getMessage("popupAttachmentSizeIncreaseHeadline"),
        "tipBody": browser.i18n.getMessage("popupAttachmentSizeIncreaseBody"),
      },
      "panel3": {
        "imgSrcPremium": "/educational-matrix/educationalImg-block-emails.svg",
        "tipHeadline": browser.i18n.getMessage("popupBlockPromotionalEmailsHeadline_2"),
        "tipBody": browser.i18n.getMessage("popupBlockPromotionalEmailsBody_mask"),
      },
      "panel4": {
        "imgSrcPremium": "/educational-matrix/educationalImg-sign-back-in.svg",
        "tipHeadline": browser.i18n.getMessage("popupSignBackInHeadline_mask"),
        "tipBody": browser.i18n.getMessage("popupSignBackInBody_mask_v2"),
        "longText": true,
      }
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

    dontShowPanelAgain: ()=> {
      browser.storage.local.set({ serverStoragePrompt: true });
    }
  },
};

async function choosePanel(panelId, premium, premiumSubdomainSet){
  const premiumPanelWrapper = document.querySelector(".premium-wrapper");

  if (premium) {
    document.getElementsByClassName("content-wrapper")[0].remove();
    premiumPanelWrapper.classList.remove("is-hidden");
    //Toggle register domain or education module
    checkUserSubdomain(premiumSubdomainSet);
    return "premiumPanel";
  } else {
    const premiumWrapper = document.getElementsByClassName("premium-wrapper");
    if (premiumWrapper.length) {
      premiumWrapper[0].remove();
    }

    return `panel${panelId}`;
  }
}

function checkUserSubdomain(premiumSubdomainSet){
  const educationalComponent = document.querySelector(".educational-component");
  const registerDomainComponent = document.querySelector(".register-domain-component");

  if (premiumSubdomainSet !== "None") {
    registerDomainComponent.classList.add("is-hidden");
  }

  else {
    educationalComponent.classList.add("is-hidden");
  }
}


async function showRelayPanel(tipPanelToShow) {
  const onboardingPanelWrapper = document.querySelector("onboarding-panel");
  const tipImageEl = onboardingPanelWrapper.querySelector("img");
  const tipHeadlineEl = onboardingPanelWrapper.querySelector(".onboarding-h1");
  const tipBodyEl = onboardingPanelWrapper.querySelector(".onboarding-p");
  const currentPanel = onboardingPanelWrapper.querySelector(".current-panel");
  const upgradeButtonEl = onboardingPanelWrapper.querySelector(".upgrade-banner");
  const upgradeButtonIconEl = onboardingPanelWrapper.querySelector(".upgrade-banner-icon");
  const promoElements = onboardingPanelWrapper.querySelectorAll(".js-promo-item");
  const tipCtaEl = onboardingPanelWrapper.querySelector(".onboarding-cta");
  let premiumPanelStrings = getEducationalStrings();
  let onboardingPanelStrings = await getOnboardingPanels();

  // const isBundleAvailableInCountry = (await browser.storage.local.get("bundlePlans")).bundlePlans.BUNDLE_PLANS.available_in_country;
  const isPhoneAvailableInCountry = (await browser.storage.local.get("phonePlans")).phonePlans.PHONE_PLANS.available_in_country;
  
  const phoneMaskingAvailable =    await checkWaffleFlag("phones") && isPhoneAvailableInCountry;
  // TODO: Enable this when bundle pricing has been confirmed
  // const bundleAvailable =    await checkWaffleFlag("bundle") && isBundleAvailableInCountry;

  if (
    phoneMaskingAvailable 
    // && bundleAvailable
  ) {
    promoElements.forEach(i => {
      i.classList.remove("is-hidden");
    });
    onboardingPanelWrapper.setAttribute("id", "bundle-phones-promo");
    onboardingPanelStrings = await getPromoPanels();
    premiumPanelStrings = await getPromoPanels();
  }

  if (!browser.menus) {
    // Remove sign back in for browsers that don't support menus API (Chrome)
    delete onboardingPanelStrings.announcements.panel3;
    delete premiumPanelStrings.announcements.panel4;
  }

  //Premium Panel
  const premiumPanelWrapper = document.querySelector(".premium-wrapper");
  const registerDomainImgEl = premiumPanelWrapper.querySelector(".email-domain-illustration");

  //Dashboard Statistics
  const dashboardStatistics = document.querySelectorAll(".dashboard-stats-list");

  //Get profile data from site
  const { aliasesUsedVal } = await browser.storage.local.get("aliasesUsedVal");
  const { emailsForwardedVal } = await browser.storage.local.get("emailsForwardedVal");
  const { emailsBlockedVal } = await browser.storage.local.get("emailsBlockedVal");
  const { emailTrackersRemovedVal } = await browser.storage.local.get("emailTrackersRemovedVal");

  dashboardStatistics.forEach((statSet) => {
    const aliasesUsedValEl = statSet.querySelector(".aliases-used");
    const emailsBlockedValEl = statSet.querySelector(".emails-blocked");
    const emailsForwardedValEl = statSet.querySelector(".emails-forwarded");
    const emailTrackersRemovedValEl = statSet.querySelector(".email-trackers-removed");

    aliasesUsedValEl.textContent = aliasesUsedVal;
    emailsBlockedValEl.textContent = emailsBlockedVal;
    emailsForwardedValEl.textContent = emailsForwardedVal;
    emailTrackersRemovedValEl.textContent = emailTrackersRemovedVal;
  });

  //Check if premium features are available
  const premiumCountryAvailability = (await browser.storage.local.get("premiumCountries"))?.premiumCountries?.PREMIUM_PLANS;

  //Check if user is premium
  const { premium } = await browser.storage.local.get("premium");
  
  //Check if user has a subdomain set
  const { premiumSubdomainSet } = await browser.storage.local.get("premiumSubdomainSet");

  //Educational Panel
  const educationalImgEl = premiumPanelWrapper.querySelector(".education-img");
  const educationHeadlineEl = premiumPanelWrapper.querySelector(".education-headline");
  const educationBodyEl = premiumPanelWrapper.querySelector(".education-body");
  const currentEducationalPanel = premiumPanelWrapper.querySelector(".current-panel");
  const educationalCtaEl = premiumPanelWrapper.querySelector(".onboarding-cta");

  const updatePremiumPanel = async (panelId) => {
    const panelToShow =  `panel${panelId}`;
    premiumPanelWrapper.setAttribute("id", panelToShow);
    const panelStrings = premiumPanelStrings.announcements[`${panelToShow}`];
    if (!panelStrings) {
      // Exit early if on a non-onboarding
      return;
    }
    educationBodyEl.classList.remove("small-font-size");
    if (panelStrings.longText) {
      educationBodyEl.classList.add("small-font-size");
    }

    const totalPanels = Object.keys(premiumPanelStrings.announcements).length;
    setPagination(panelId, totalPanels);

    educationHeadlineEl.textContent = panelStrings.tipHeadline;
    educationBodyEl.textContent = panelStrings.tipBody;
    educationalImgEl.src = `/images/panel-images/${panelStrings.imgSrcPremium}`;
    educationalCtaEl.textContent = panelStrings.tipCta;
    currentEducationalPanel.textContent = `${tipPanelToShow}`;

    registerDomainImgEl.src = `/images/panel-images/email-domain-illustration.svg`;

    // Remove panel status if user has unlimited aliases, so no negative alias left count
    if (premium) {
      const panelStatus = document.querySelector(".panel-status");
      panelStatus.classList.add("is-hidden");
    }

    return;
  };

  const updatePanel = async (numRemaining, panelId) => {
    // TODO: Add " && bundleAvailable " when bundle pricing has been confirmed
    const bundlePhoneMaskingAvailable = phoneMaskingAvailable;
    
    const panelToShow = await choosePanel(panelId, premium, premiumSubdomainSet);
    onboardingPanelWrapper.classList = [panelToShow];
    
    const totalPanels = Object.keys(onboardingPanelStrings.announcements).length;
    let panelStrings = onboardingPanelStrings.announcements[`${panelToShow}`];

    setPagination(panelId, totalPanels);

    // Only show maxAliasesPanel to users where bundle / phone masking is unavailable
    // Otherwise, show Phone masking and Bundle promo
    if (!premium && numRemaining === 0 && !bundlePhoneMaskingAvailable) {
      panelStrings = onboardingPanelStrings["maxAliasesPanel"];
      onboardingPanelWrapper.classList = "maxAliasesPanel";

      if (premiumCountryAvailability?.premium_available_in_country === true) {
        const upgradeButton = document.querySelector(".upgrade-banner-wrapper");
        upgradeButton.classList.remove("is-hidden");
      }
    }
    if (!panelStrings) {
      // Exit early if on a non-onboarding
      return;
    }

    tipImageEl.src = `/images/panel-images/${panelStrings.imgSrc}`;
    tipHeadlineEl.textContent = panelStrings.tipHeadline;
    tipBodyEl.textContent = panelStrings.tipBody;
    tipCtaEl.textContent = panelStrings.tipCta;
    currentPanel.textContent = `${panelId}`;
    upgradeButtonEl.textContent = panelStrings.upgradeButton;
    upgradeButtonIconEl.src = panelStrings.upgradeButtonIcon;

    //If Premium features are not available, do not show upgrade CTA on the panel
    if (premiumCountryAvailability?.premium_available_in_country === true) {
      const premiumCTA = document.querySelector(".premium-cta");
      premiumCTA.classList.remove("is-hidden");
    }
    
    return;
  };

  const setPagination = (activePanel, totalPanels) => {
    const pagination = onboardingPanelWrapper.querySelector(".onboarding-pagination");
    const prevButton = onboardingPanelWrapper.querySelector(".previous-panel");
    const nextButton = onboardingPanelWrapper.querySelector(".next-panel");
    const totalPanelsEl = document.querySelector(".total-panels");
    // Number of panels available for free users
    totalPanelsEl.textContent = totalPanels;
    prevButton.classList.remove("is-invisible");
    nextButton.classList.remove("is-invisible");
    // If user is at the start of the carousel, hide next button
    if (activePanel === 1) {
      prevButton.classList.add("is-invisible");
    }
    // If user is at the end of the carousel, hide next button
    if (activePanel === totalPanels) {
      nextButton.classList.add("is-invisible");
    }
    if (totalPanels === 1) {
      pagination.classList.add("is-hidden");
    }
  }

  //Nonpremium panel status 
  const { relayAddresses, maxNumAliases } = await getRemainingAliases();
  const numRemaining = maxNumAliases - relayAddresses.length;
  const remainingAliasMessage = document.querySelector(".aliases-remaining");
  remainingAliasMessage.textContent = browser.i18n.getMessage("popupRemainingAliases_2_mask", [numRemaining, maxNumAliases]);
  const getUnlimitedAliases = document.querySelector(".premium-cta");
  getUnlimitedAliases.textContent = browser.i18n.getMessage("popupGetUnlimitedAliases_mask");

  document.body.classList.add("relay-panel");
  updatePremiumPanel(tipPanelToShow);
  updatePanel(numRemaining, tipPanelToShow);

  document.querySelectorAll(".panel-nav").forEach(navBtn => {
    navBtn.addEventListener("click", () => {
      sendRelayEvent("Panel", "click", "panel-navigation-arrow");
      // pointer events are disabled in popup CSS for the "previous" button on panel 1
      // and the "next" button on panel 3
      const nextPanel = (navBtn.dataset.direction === "-1") ? -1 : 1;
      return updatePanel(numRemaining, tipPanelToShow+=nextPanel);
    });
  });

  document.querySelectorAll(".premium-panel-nav").forEach(navBtn => {
    navBtn.addEventListener("click", () => {
      sendRelayEvent("Panel", "click", "panel-navigation-arrow");
      // pointer events are disabled in popup CSS for the "previous" button on panel 1
      // and the "next" button on panel 3
      const nextPanel = (navBtn.dataset.direction === "-1") ? -1 : 1;
      return updatePremiumPanel(tipPanelToShow+=nextPanel);
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

  const reportForm = document.querySelector('.report-issue-content > input[type="checkbox"');

  console.log(reportForm);

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
  const inputFieldUrl = document.querySelector('input[name="issue_on_domain"]');
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

  // Add backlink to pricing section from promo CTAs
  const promoCTAEl = document.querySelectorAll(".js-promo-link");
  promoCTAEl.forEach(i => {
    i.href = `${relaySiteOrigin}/premium#pricing`;
  })

}

document.addEventListener("DOMContentLoaded", popup);
