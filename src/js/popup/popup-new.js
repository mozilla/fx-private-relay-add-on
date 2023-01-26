/* global getBrowser checkWaffleFlag */

(async () => {
  // Global Data
  const { relaySiteOrigin } = await browser.storage.local.get(
    "relaySiteOrigin"
  );

  const state = {
    currentPanel: null,
  };

  // audience can be premium, free, phones, all
  // Optional data: waffle, fullCta*
  const savings = "40%"; // For "Save 40%!" in the Bundle promo body
  const getBundlePlans = (await browser.storage.local.get("bundlePlans")).bundlePlans.BUNDLE_PLANS;
  const getBundlePrice = getBundlePlans.plan_country_lang_mapping[getBundlePlans.country_code].en.yearly.price;
  const getBundleCurrency = getBundlePlans.plan_country_lang_mapping[getBundlePlans.country_code].en.yearly.currency
  const userLocale = navigator.language;
  const formattedBundlePrice = new Intl.NumberFormat(userLocale, {
    style: "currency",
    currency: getBundleCurrency,
  }).format(getBundlePrice);
  
  // "panel1": {
  //   "imgSrc": "announcements/panel-phone-masking-announcement.svg",
  //   "imgSrcPremium": "announcements/premium-announcement-phone-masking.svg",
  //   "tipHeadline": browser.i18n.getMessage("popupPhoneMaskingPromoHeadline"),
  //   "longText": true,
  //   "tipBody": browser.i18n.getMessage("popupPhoneMaskingPromoBody"),
  //   "tipCta": browser.i18n.getMessage("popupPhoneMaskingPromoCTA"),
  // },
  // "panel2": {
  //   "imgSrc": "announcements/panel-bundle-announcement.svg",
  //   "imgSrcPremium": "announcements/premium-announcement-bundle.svg",
  //   "tipHeadline": browser.i18n.getMessage("popupBundlePromoHeadline_2", savings),
  //   "tipBody": browser.i18n.getMessage("popupBundlePromoBody_3", formattedBundlePrice),
  //   "tipCta": browser.i18n.getMessage("popupBundlePromoCTA"),
  // },
  
  // FIXME: The order is not being set correctly
  const newsContent = [
    {
      id: "firefox-integration",
      waffle: "firefox_integration",
      locale: "us",
      audience: "premium",
      headlineString: "popupPasswordManagerRelayHeadline",
      bodyString: "popupPasswordManagerRelayBody",
      teaserImg:
        "/images/panel-images/announcements/panel-announcement-password-manager-relay-square-illustration.svg",
      fullImg:
        "/images/panel-images/announcements/panel-announcement-password-manager-relay-illustration.svg",
    },
    {
      id: "mozilla-vpn-bundle",
      headlineString: "popupBundlePromoHeadline_2",
      headlineStringArgs: savings,
      bodyString: "popupBundlePromoBody_3",
      bodyStringArgs: formattedBundlePrice,
      teaserImg:
        "/images/panel-images/announcements/panel-bundle-announcement-square.svg",
      fullImg:
        "/images/panel-images/announcements/panel-bundle-announcement.svg",
      fullCta: "popupPhoneMaskingPromoCTA",
      fullCtaRelayURL: true,
      fullCtaHref:
        "/premium/#pricing?utm_source=fx-relay-addon&utm_medium=popup&utm_content=panel-news-bundle-cta",
      fullCtaEventLabel: "panel-news-bundle-cta",
      fullCtaEventAction: "click",
    },
    {
      id: "phones",
      headlineString: "popupPhoneMaskingPromoHeadline",
      bodyString: "popupPhoneMaskingPromoBody",
      teaserImg:
        "/images/panel-images/announcements/premium-announcement-phone-masking.svg",
      fullImg:
        "/images/panel-images/announcements/premium-announcement-phone-masking-hero.svg",
      fullCta: "popupPhoneMaskingPromoCTA",
      fullCtaRelayURL: true,
      fullCtaHref:
        "premium/#pricing?utm_source=fx-relay-addon&utm_medium=popup&utm_content=panel-news-phone-masking-cta",
      fullCtaEventLabel: "panel-news-phone-masking-cta",
      fullCtaEventAction: "click",
    },
  ];

  const popup = {
    events: {
      backClick: (e) => {
        e.preventDefault();
        const backTarget = e.target.dataset.backTarget;
        const backNavLevel = e.target.dataset.navLevel;

        if (backNavLevel === "root") {
          document
            .querySelector(".js-internal-link.is-active")
            ?.classList.remove("is-active");
        }

        // Custom rule to send "Closed Report Issue" event
        if (e.target.dataset.navId && e.target.dataset.navId === "webcompat") {
          sendRelayEvent("Panel", "click", "closed-report-issue");
        }

        popup.panel.update(backTarget);
      },
      externalClick: async (e) => {
        e.preventDefault();
        if (e.target.dataset.eventLabel && e.target.dataset.eventAction) {
          sendRelayEvent(
            "Panel",
            e.target.dataset.eventAction,
            e.target.dataset.eventLabel
          );
        }
        await browser.tabs.create({ url: e.target.href });
        window.close();
      },
      navigationClick: (e) => {
        e.preventDefault();
        document
          .querySelector(".js-internal-link.is-active")
          ?.classList.remove("is-active");
        e.target.classList.add("is-active");
        const panelId = e.target.dataset.panelId;
        popup.panel.update(panelId);
      },
    },
    init: async () => {
      // Set Navigation Listeners
      const navigationButtons = document.querySelectorAll(".js-internal-link");
      navigationButtons.forEach((button) => {
        button.addEventListener("click", popup.events.navigationClick, false);
      });

      // Set Back Button Listeners
      const backButtons = document.querySelectorAll(
        ".fx-relay-panel-header-btn-back"
      );
      backButtons.forEach((button) => {
        button.addEventListener("click", popup.events.backClick, false);
      });

      // Check if user is signed in to show default/sign-in panel
      if (await popup.utilities.isUserSignedIn()) {
        popup.panel.update("masks");
        popup.utilities.unhideNavigationItemsOnceLoggedIn();
      } else {
        popup.panel.update("sign-up");
      }

      // Set External Event Listerners
      await popup.utilities.setExternalLinkEventListeners();
    },
    panel: {
      update: (panelId, data) => {
        const panels = document.querySelectorAll(".fx-relay-panel");
        panels.forEach((panel) => {
          panel.classList.add("is-hidden");

          if (panel.dataset.panelId === panelId) {
            panel.classList.remove("is-hidden");
            popup.panel.init(panelId, data);
          }
        });

        state.currentPanel = panelId;
      },
      init: (panelId, data) => {
        switch (panelId) {
          case "news":
            sendRelayEvent("Panel", "click", "opened-news");
            popup.panel.news.init();
            break;
          case "newsStory":
            sendRelayEvent("Panel", "click", "opened-news-item");
            popup.panel.news.storyPanel.update(data.newsItemId);
            break;
          case "settings":
            popup.utilities.enableInputIconDisabling();
            // Function is imported from data-opt-out-toggle.js
            enableDataOptOut();

            document
              .getElementById("popupSettingsReportIssue")
              .addEventListener(
                "click",
                (e) => {
                  e.preventDefault();
                  popup.panel.update("webcompat");
                },
                false
              );

            break;
          case "stats":
            sendRelayEvent("Panel", "click", "opened-stats");
            popup.panel.stats.init();
            break;

          case "webcompat":
            sendRelayEvent("Panel", "click", "opened-report-issue");
            popup.panel.webcompat.init();
            break;

          default:
            break;
        }
      },
      news: {
        init: async () => {

          const newsList = document.querySelector(".fx-relay-news");

          // If there's no news items, go build them
          if ( !newsList.hasChildNodes() ) {
            newsContent.forEach(async (newsItem) => {
              // Check for any catches to not display the item
              if (
                // Waffle
                newsItem.waffle &&
                (await checkWaffleFlag(newsItem.waffle)) === false
                // TODO: Add locale filtering
                // TODO: Add free/premium filtering
              ) {
                return;
              }

              // Build and attach news item
              const liFxRelayNewsItem = document.createElement("li");
              liFxRelayNewsItem.classList.add("fx-relay-news-item");

              const button = document.createElement("button");
              button.classList.add("fx-relay-news-item-button");
              button.setAttribute("data-news-item-id", newsItem.id);
              liFxRelayNewsItem.appendChild(button);

              const divTeaserImage = document.createElement("div");
              divTeaserImage.classList.add("fx-relay-news-item-image");

              const imgTeaserImage = document.createElement("img");
              imgTeaserImage.src = newsItem.teaserImg;
              divTeaserImage.appendChild(imgTeaserImage);
              button.appendChild(divTeaserImage);

              const divTeaserCopy = document.createElement("div");
              divTeaserCopy.classList.add("fx-relay-news-item-content");

              const h3TeaserTitle = document.createElement("h3");
              h3TeaserTitle.classList.add("fx-relay-news-item-hero");
              // Pass i18n Args if applicable
              const h3TeaserTitleTextContent = newsItem.headlineStringArgs
                ? browser.i18n.getMessage(
                    newsItem.headlineString,
                    newsItem.headlineStringArgs
                  )
                : browser.i18n.getMessage(newsItem.headlineString);
              h3TeaserTitle.textContent = h3TeaserTitleTextContent;

              const divTeaserBody = document.createElement("div");
              divTeaserBody.classList.add("fx-relay-news-item-body");
              // Pass i18n Args if applicable
              const divTeaserBodyTextContent = newsItem.bodyStringArgs
                ? browser.i18n.getMessage(
                    newsItem.bodyString,
                    newsItem.bodyStringArgs
                  )
                : browser.i18n.getMessage(newsItem.bodyString);
              divTeaserBody.textContent = divTeaserBodyTextContent;

              divTeaserCopy.appendChild(h3TeaserTitle);
              divTeaserCopy.appendChild(divTeaserBody);
              button.appendChild(divTeaserCopy);

              newsList.appendChild(liFxRelayNewsItem);

              button.addEventListener(
                "click",
                popup.panel.news.storyPanel.show,
                false
              );
            });
          }
        },
        storyPanel: {
          show: (event) => {
            popup.panel.update("newsStory", {
              newsItemId: event.target.dataset.newsItemId,
            });
          },
          update: (newsItemId) => {
            // Get content for news detail view
            const storyData = newsContent.filter((story) => { return story.id == newsItemId });
            const newsItemContent = storyData[0];
            
            const newsStoryDetail = document.querySelector(".fx-relay-news-story");
            
            // Reset news detail item
            newsStoryDetail.textContent = "";

             // Populate HTML
            const newsStoryHeroImage = document.createElement("img");
            newsStoryHeroImage.src = newsItemContent.fullImg;
            newsStoryDetail.appendChild(newsStoryHeroImage);
            
            const newsStoryHeroTitle = document.createElement("h3");
            const newsStoryHeroTitleTextContent = newsItemContent.headlineStringArgs
              ? browser.i18n.getMessage(
                  newsItemContent.headlineString,
                  newsItemContent.headlineStringArgs
                )
              : browser.i18n.getMessage(newsItemContent.headlineString);
            newsStoryHeroTitle.textContent = newsStoryHeroTitleTextContent;
            newsStoryDetail.appendChild(newsStoryHeroTitle);
            
            const newsStoryHeroBody = document.createElement("div");
            // Pass i18n Args if applicable
            const newsStoryHeroBodyTextContent = newsItemContent.bodyStringArgs
              ? browser.i18n.getMessage(
                  newsItemContent.bodyString,
                  newsItemContent.bodyStringArgs
                )
              : browser.i18n.getMessage(newsItemContent.bodyString);
            newsStoryHeroBody.textContent = newsStoryHeroBodyTextContent;
            newsStoryDetail.appendChild(newsStoryHeroBody);

            // If the section has a CTA, add it.
            if (newsItemContent.fullCta) {
              const newsStoryHeroCTA = document.createElement("a");
              newsStoryHeroCTA.classList.add("fx-relay-news-story-link");

              // If the URL points towards Relay, choose the correct server
              if (newsItemContent.fullCtaRelayURL) {
                newsStoryHeroCTA.href = `${relaySiteOrigin}${newsItemContent.fullCtaHref}`;
              } else {
                newsStoryHeroCTA.href = `${newsItemContent.fullCtaHref}`;
              }
              
              // Set GA data if applicable
              if (newsItemContent.fullCtaEventLabel && newsItemContent.fullCtaEventAction) {
                newsStoryHeroCTA.setAttribute("data-event-action", newsItemContent.fullCtaEventAction);
                newsStoryHeroCTA.setAttribute("data-event-label", newsItemContent.fullCtaEventLabel);
              }

              newsStoryHeroCTA.textContent = browser.i18n.getMessage(newsItemContent.fullCta);
              newsStoryHeroCTA.addEventListener("click", popup.events.externalClick, false);
              newsStoryDetail.appendChild(newsStoryHeroCTA);
            }
          },
        },
      },
      stats: {
        init: async () => {
          // Get Global Mask Stats data
          const { aliasesUsedVal } = await browser.storage.local.get(
            "aliasesUsedVal"
          );
          const { emailsForwardedVal } = await browser.storage.local.get(
            "emailsForwardedVal"
          );
          const { emailsBlockedVal } = await browser.storage.local.get(
            "emailsBlockedVal"
          );

          const globalStatSet = document.querySelector(
            ".dashboard-stats-list.global-stats"
          );

          const globalAliasesUsedValEl =
            globalStatSet.querySelector(".aliases-used");
          const globalEmailsBlockedValEl =
            globalStatSet.querySelector(".emails-blocked");
          const globalEmailsForwardedValEl =
            globalStatSet.querySelector(".emails-forwarded");

          globalAliasesUsedValEl.textContent = aliasesUsedVal;
          globalEmailsBlockedValEl.textContent = emailsBlockedVal;
          globalEmailsForwardedValEl.textContent = emailsForwardedVal;

          // Check if any data applies to the current site
          const currentPageHostName = await browser.runtime.sendMessage({
            method: "getCurrentPageHostname",
          });

          // Check if user is premium (and then check if they have a domain set)
          // This is needed in order to query both random and custom masks
          const { premium } = await browser.storage.local.get("premium");
          let getMasksOptions = { fetchCustomMasks: false };

          if (premium) {
            // Check if user may have custom domain masks
            const { premiumSubdomainSet } = await browser.storage.local.get(
              "premiumSubdomainSet"
            );

            // API Note: If a user has not registered a subdomain yet, its default stored/queried value is "None";
            const isPremiumSubdomainSet = premiumSubdomainSet !== "None";
            getMasksOptions.fetchCustomMasks = isPremiumSubdomainSet;
          }

          const masks = await popup.utilities.getMasks(getMasksOptions);

          const currentWebsiteStateSet = document.querySelector(
            ".dashboard-stats-list.current-website-stats"
          );

          if (
            popup.utilities.checkIfAnyMasksWereGeneratedOnCurrentWebsite(
              masks,
              currentPageHostName
            )
          ) {
            // Some masks are used on the current site. Time to calculate!
            const filteredMasks = masks.filter(
              (mask) =>
                mask.generated_for === currentPageHostName ||
                popup.utilities.hasMaskBeenUsedOnCurrentSite(
                  mask,
                  currentPageHostName
                )
            );

            let currentWebsiteForwardedVal = 0;
            let currentWebsiteBlockedVal = 0;

            filteredMasks.forEach((mask) => {
              currentWebsiteForwardedVal += mask.num_forwarded;
              currentWebsiteBlockedVal += mask.num_blocked;
            });

            const currentWebsiteAliasesUsedValEl =
              currentWebsiteStateSet.querySelector(".aliases-used");
            currentWebsiteAliasesUsedValEl.textContent = filteredMasks.length;

            const currentWebsiteEmailsForwardedValEl =
              currentWebsiteStateSet.querySelector(".emails-forwarded");
            currentWebsiteEmailsForwardedValEl.textContent =
              currentWebsiteForwardedVal;

            const currentWebsiteEmailsBlockedValEl =
              currentWebsiteStateSet.querySelector(".emails-blocked");
            currentWebsiteEmailsBlockedValEl.textContent =
              currentWebsiteBlockedVal;

            const currentWebsiteEmailsBlocked =
              currentWebsiteStateSet.querySelector(
                ".dashboard-info-emails-blocked"
              );
            const currentWebsiteEmailsForwarded =
              currentWebsiteStateSet.querySelector(
                ".dashboard-info-emails-forwarded"
              );
            currentWebsiteEmailsBlocked.classList.remove("is-hidden");
            currentWebsiteEmailsForwarded.classList.remove("is-hidden");
          }
        },
      },
      webcompat: {
        init: () => {
          popup.panel.webcompat.setURLwithIssue();
          popup.panel.webcompat.showReportInputOtherTextField();
          popup.panel.webcompat.showSuccessReportSubmission();

          const reportForm = document.querySelector(".report-issue-content");
          reportForm.addEventListener("submit", async (event) => {
            await popup.panel.webcompat.handleReportIssueFormSubmission(event);
          });

          const reportContinueButton =
            document.querySelector(".report-continue");
          reportContinueButton.addEventListener(
            "click",
            popup.events.backClick,
            false
          );
        },
        setURLwithIssue: async () => {
          // Add Site URL placeholder
          const currentPage = (await popup.utilities.getCurrentPage()).url;
          const reportIssueSubmitBtn = document.querySelector(
            ".report-issue-submit-btn"
          );
          const inputFieldUrl = document.querySelector(
            'input[name="issue_on_domain"]'
          );
          reportIssueSubmitBtn.disabled = true;

          // Allow for custom URL inputs
          inputFieldUrl.addEventListener("input", () => {
            reportIssueSubmitBtn.disabled = true;
            // Ensure that the custom input looks like a URL without https:// or http:// (e.g. test.com, www.test.com)
            if (popup.utilities.isSortaAURL(inputFieldUrl.value)) {
              reportIssueSubmitBtn.disabled = false;
            }
          });

          // Check that the host site has a valid URL
          if (currentPage) {
            const url = new URL(currentPage);
            // returns a http:// or https:// value
            inputFieldUrl.value = url.origin;
            reportIssueSubmitBtn.disabled = false;
          }
        },
        showReportInputOtherTextField: () => {
          const otherCheckbox = document.querySelector(
            'input[name="issue-case-other"]'
          );
          const otherTextField = document.querySelector(
            'input[name="other_issue"]'
          );
          otherCheckbox.addEventListener("click", () => {
            otherTextField.classList.toggle("is-hidden");
          });

          // Add placeholder to report input on 'Other' selection
          const inputFieldOtherDetails = document.querySelector(
            'input[name="other_issue"]'
          );
          inputFieldOtherDetails.placeholder = browser.i18n.getMessage(
            "popupReportIssueCaseOtherDetails"
          );
        },
        showSuccessReportSubmission: () => {
          const reportIssueSubmitBtn = document.querySelector(
            ".report-issue-submit-btn"
          );
          const reportSuccess = document.querySelector(".report-success");
          const reportContent = document.querySelector(".report-issue-content");
          reportIssueSubmitBtn.addEventListener("click", () => {
            reportSuccess.classList.remove("is-hidden");
            reportContent.classList.add("is-hidden");
          });
        },
        handleReportIssueFormSubmission: async (event) => {
          event.preventDefault();
          const data = new FormData(event.target);
          const reportData = Object.fromEntries(data.entries());
          reportData.user_agent = await getBrowser();

          Object.keys(reportData).forEach(function (value) {
            // Switch "on" to true
            if (reportData[value] === "on") {
              reportData[value] = true;
            }
            // Remove from report if empty string
            if (reportData[value] === "") {
              delete reportData[value];
            }
          });

          // Clean URL data to add "http://" before it if the custom input doesn't contain a HTTP protocol
          if (
            !(
              reportData.issue_on_domain.startsWith("http://") ||
              reportData.issue_on_domain.startsWith("https://")
            )
          ) {
            reportData.issue_on_domain = "http://" + reportData.issue_on_domain;
          }

          await browser.runtime.sendMessage({
            method: "postReportWebcompatIssue",
            description: reportData,
          });
        },
      },
    },
    utilities: {
      checkIfAnyMasksWereGeneratedOnCurrentWebsite: (masks, domain) => {
        return masks.some((mask) => {
          return domain === mask.generated_for;
        });
      },
      clearBrowserActionBadge: async () => {
        const { browserActionBadgesClicked } = await browser.storage.local.get(
          "browserActionBadgesClicked"
        );

        // Dismiss the browserActionBadge only when it exists
        if (browserActionBadgesClicked === false) {
          browser.storage.local.set({ browserActionBadgesClicked: true });
          browser.browserAction.setBadgeBackgroundColor({ color: null });
          browser.browserAction.setBadgeText({ text: "" });
        }
      },
      enableInputIconDisabling: async () => {
        const inputIconVisibilityToggle = document.querySelector(
          ".toggle-icon-in-page-visibility"
        );

        const stylePrefToggle = (inputsEnabled) => {
          if (inputsEnabled === "show-input-icons") {
            inputIconVisibilityToggle.dataset.iconVisibilityOption =
              "disable-input-icon";
            inputIconVisibilityToggle.classList.remove("input-icons-disabled");
            return;
          }
          inputIconVisibilityToggle.dataset.iconVisibilityOption =
            "enable-input-icon";
          inputIconVisibilityToggle.classList.add("input-icons-disabled");
        };

        const iconsAreEnabled = await areInputIconsEnabled();
        const userIconChoice = iconsAreEnabled
          ? "show-input-icons"
          : "hide-input-icons";
        stylePrefToggle(userIconChoice);

        inputIconVisibilityToggle.addEventListener("click", async () => {
          const userIconPreference =
            inputIconVisibilityToggle.dataset.iconVisibilityOption ===
            "disable-input-icon"
              ? "hide-input-icons"
              : "show-input-icons";
          await browser.runtime.sendMessage({
            method: "updateInputIconPref",
            iconPref: userIconPreference,
          });
          sendRelayEvent("Panel", "click", userIconPreference);
          return stylePrefToggle(userIconPreference);
        });
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
        if (domainList.split(",").includes(domain)) {
          return true;
        }

        // No match found!
        return false;
      },
      isSortaAURL: (str) => {
        return str.includes(".") && !str.endsWith(".") && !str.startsWith(".");
      },
      isUserSignedIn: async () => {
        const userApiToken = await browser.storage.local.get("apiToken");
        const signedInUser = Object.prototype.hasOwnProperty.call(
          userApiToken,
          "apiToken"
        );
        return signedInUser;
      },
      getCachedServerStoragePref: async () => {
        const serverStoragePref = await browser.storage.local.get(
          "server_storage"
        );
        const serverStoragePrefInLocalStorage =
          Object.prototype.hasOwnProperty.call(
            serverStoragePref,
            "server_storage"
          );

        if (!serverStoragePrefInLocalStorage) {
          // There is no reference to the users storage preference saved. Fetch it from the server.
          return await browser.runtime.sendMessage({
            method: "getServerStoragePref",
          });
        } else {
          // If the stored pref exists, return value
          return serverStoragePref.server_storage;
        }
      },
      getCurrentPage: async () => {
        const [currentTab] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        return currentTab;
      },
      getMasks: async (options = { fetchCustomMasks: false }) => {
        const serverStoragePref =
          await popup.utilities.getCachedServerStoragePref();

        if (serverStoragePref) {
          try {
            return await browser.runtime.sendMessage({
              method: "getAliasesFromServer",
              options,
            });
          } catch (error) {
            console.warn(`getAliasesFromServer Error: ${error}`);

            // API Error — Fallback to local storage
            const { relayAddresses } = await browser.storage.local.get(
              "relayAddresses"
            );

            return relayAddresses;
          }
        }
      },
      setExternalLinkEventListeners: async () => {
        const externalLinks = document.querySelectorAll(".js-external-link");

        externalLinks.forEach((link) => {
          // Because we dynamically set the Relay origin URL (local/dev/stage/prod),
          // we have to catch Relay-specific links and prepend the correct Relay website URL
          if (link.dataset.relayInternal === "true") {
            // TODO: Remove "/" from here. It'll be error prone
            link.href = `${relaySiteOrigin}/${link.dataset.href}`;
          } else {
            link.href = `${link.dataset.href}`;
          }

          link.addEventListener("click", popup.events.externalClick, false);
        });
      },
      unhideNavigationItemsOnceLoggedIn: () => {
        document
          .querySelectorAll(".fx-relay-menu-dashboard-link.is-hidden")
          .forEach((link) => {
            link.classList.remove("is-hidden");
          });
      },
    },
  };

  popup.init();
})();
