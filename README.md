<p align="center">
<img src="https://raw.githubusercontent.com/mozilla/fx-private-relay/11ad17e197e23a0453bfb74fa3670c87cfc35e36/frontend/src/components/landing/images/logo-firefox-relay.svg" width="250" />
</p>


# Private Relay 
<!-- Badges include: license and size of repository -->
[![License: MPL 2.0](https://img.shields.io/badge/License-MPL%202.0-brightgreen.svg)](https://raw.githubusercontent.com/mozilla/fx-private-relay-add-on/main/LICENSE)
![Repo Size](https://img.shields.io/github/repo-size/Mozilla/fx-private-relay-add-on)

Private Relay generates email aliases to use in place of personal email addresses.

Recipients will still receive emails, but Private Relay keeps their personal
email address from being [harvested](https://blog.hubspot.com/marketing/what-is-a-landing-page-ht), 
and then [bought, sold, traded, or combined](https://www.bookyourdata.com/) 
with  other data to personally identify, track, and/or [target
them](https://www.facebook.com/business/help/606443329504150?helpref=faq_content).

- [Private Relay](#private-relay)
  - [Usage (for now)](#usage-for-now)
  - [Local Extension Development](#local-extension-development)
    - [Working with translations](#working-with-translations)
      - [Getting the latest translations](#getting-the-latest-translations)
      - [Running with the latest translations](#running-with-the-latest-translations)
        - [Create a Firefox profile set to use the target language](#create-a-firefox-profile-set-to-use-the-target-language)
        - [Run `web-ext` with that profile](#run-web-ext-with-that-profile)
      - [Add/update messages for translation](#addupdate-messages-for-translation)
  - [Build for other environments](#build-for-other-environments)
    - [Distributing](#distributing)
      - [Add-on Submission Process](#add-on-submission-process)
      - [Continuous Pre-releases](#continuous-pre-releases)
      - [Make the new version](#make-the-new-version)
      - [Publish to AMO](#publish-to-amo)
      - [Publish to Chrome](#publish-to-chrome)
      - [Publish to GitHub](#publish-to-github)
  
## Usage (for now)

1. Install the extension.

2. Go to [relay.firefox.com](https://relay.firefox.com) and sign in.

3. In any `<input>` element, right-click and select "Make a relay address"
   * The extension will populate the options with your relay addresses.


## Local Extension Development

1. Clone, change to the directory, install dependencies:

    ```
    git clone --recurse-submodules git@github.com:mozilla/fx-private-relay-add-on.git
    npm install
    ```

2. Run with `npm`:

    ```
    npm run web-ext-run
    ```

   By default, this will open and run the extension in Firefox. If you'd like to run this in Chrome, run the following:
   
   > [!WARNING]
   > This will run a script that will introduce breaking changes to `manifest.json`. Please do not commit any script-changed edits to your PR.

      ```
      npm run web-ext-run:chrome
      ```

   If you want to run the extension on Android, you'll need to install the [Android SDK platform tools](https://developer.android.com/studio/releases/platform-tools.html):

      ```
      npm run web-ext-run:android --device=DEVICE_ID
      ```

   Please refer to [extensionworkshop.com](https://extensionworkshop.com/documentation/develop/developing-extensions-for-firefox-for-android/) to learn more about how to run an extension on Android.

3. Visit http://127.0.0.1:8000


### Working with translations
#### Getting the latest translations
We use a [git submodule](https://git-scm.com/book/en/v2/Git-Tools-Submodules)
for translated message files. The `--recurse-submodules` step of installation
should bring the message files into your working directory already, but you may
want also want to udpate the translations after install. The easiest way to do
that is:

* `git submodule update --init --remote`

#### Running with the latest translations

To run the latest translated version of the add-on, you will need to 

1. Create a Firefox profile set to use the target language
2. Either:
   * Run `npm run web-ext-run` with that profile
   * Install the latest
     [pre-release](https://github.com/mozilla/fx-private-relay-add-on/releases)
     in that profile

##### Create a Firefox profile set to use the target language
1. Make a new Firefox profile - e.g., "swedish"
2. In the profile, install the [language
   pack](https://addons.mozilla.org/en-US/firefox/language-tools/) for one of 
   the add-on's [supported
   languages](https://pontoon.mozilla.org/projects/firefox-relay-add-on/)
   * Note: language packs only work on Release & Beta channels of Firefox - not
     Nightly
3. In `about:preferences`, go to the "Language" section, and click the "Set
   Alternatives" button next to "Choose the languages used to display menus,
   messages, and notifications from Firefox."
4. Pick the language pack you installed.
5. Quit Firefox so the profile is saved.

##### Run `web-ext` with that profile
Use `npm run web-ext-run` to run the add-on, and pass the profile argument. 
E.g., `npm run web-ext-run -- -p "swedish"`

#### Add/update messages for translation
The `privaterelay/locales` directory is a git repository like any other, so to
make changes to the messages:

1. Make whatever changes you need in `src/_locales/en` as you work.

2. `cd src/_locales/en`

3. `git branch message-updates-yyyymmdd`

4. `git push -u origin message-updates-yyyymmdd`

You can then open a pull request from the `message-updates-yyyymmdd` branch to
[the l10n repo](https://github.com/mozilla-l10n/fx-private-relay-add-on-l10n/) `main` branch.

## Build for other environments

These scripts will build the add-on to work with dev, stage, or prod servers.

 * `npm run build:dev`: https://dev.fxprivaterelay.nonprod.cloudops.mozgcp.net/
 * `npm run build:stage`: https://stage.fxprivaterelay.nonprod.cloudops.mozgcp.net/
 * `npm run build:prod`: https://relay.firefox.com/

If you want to run the Chrome build of the add-on, use the following scripts:
 
> [!NOTE]  
> It runs the same scripts as above, but also edits the [`menus`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/menus) permission listed in the manifest.json*
 
 * `npm run build:chrome-dev`: https://dev.fxprivaterelay.nonprod.cloudops.mozgcp.net/
 * `npm run build:chrome-stage`: https://stage.fxprivaterelay.nonprod.cloudops.mozgcp.net/
 * `npm run build:chrome-prod`: https://relay.firefox.com/
 

 

### Distributing

#### Add-on Submission Process

See internal documentation [here](https://mozilla-hub.atlassian.net/wiki/spaces/SECPRV/pages/27034372/Firefox+Relay+Add-on+Submission+Process). This document outlines how to submit and release the Firefox Relay add-on (extension) to the different add-on stores.

Process summary: 

![](https://i.imgur.com/rimgrmE.png)

1. Cut Release: Create a new release on GitHub (new tag) with new version number.
2. Open ADDONOPS ticket: Create a new Jira ticket for the ADDONOPS team using their form, filling out all the particulars. 
3. QA Greenlight: Link to QA comment or have QA comment directly on the ticket with greenlight. 
4. Approval: If approval is given, you will be asked to submit to AMO.
5. Submit to AMO: Submit the add-on to AMO. <br> 
   **WARNING:** make sure to choose the right options.

#### Continuous Pre-releases

The `sign-and-release-to-github` action creates a signed add-on after every
merge to `main`. These pre-releases are available on the [GitHub Releases
page](https://github.com/mozilla/fx-private-relay-add-on/releases).

To comply with [WebExtension
version](https://developer.chrome.com/docs/extensions/mv3/manifest/version/)
requirements for AMO signing, the pre-release versions are [Calendar
Versioned](https://calver.org/) as `YYYY.MM.DD.minutes-since-midnight`

The signed `.xpi` file is named
`private_relay-${{ YYYY.MM.DD.minutes }}.xpi` and automatically attached
to each release, under the release "Assets" section.

#### Make the new version

1. Bump the version number in `package.json` and `manifest.json`
2. Commit the version number bump
3. Create a git tag for the version: `git tag <version>`
4. Push the tag up to GitHub: `git push --tags`
 
#### Publish to AMO

1. After pushing the new version to GitHub, open the "continuous prerelease to GitHub" run for that tag: https://github.com/mozilla/fx-private-relay-add-on/actions/workflows/sign-and-release-to-github.yml
2. Under "Artifacts", download `fx-private-relay-extension.zip`
3. [Upload the `.zip` to AMO](https://addons.mozilla.org/en-US/developers/addon/private-relay/versions/submit/)

**Note: Be sure the *"Where to Host Version"* is set to _"On this site"._**

#### Publish to Chrome 

1. After pushing the new version to GitHub, open the "continuous prerelease to GitHub" run for that tag: https://github.com/mozilla/fx-private-relay-add-on/actions/workflows/sign-and-release-to-github.yml
2. Under "Artifacts", download `fx-private-relay-extension.zip`
3. [Upload the `.zip` to Chrome](https://developer.chrome.com/docs/webstore/publish/)

**Note: Be sure the publisher is set to *Mozilla Corportation*.**

#### Publish to GitHub
Finally, we also publish the release to GitHub for those followers.

1. Download the signed `.xpi` from [the addon versions page](https://addons.mozilla.org/en-US/developers/addon/private-relay/versions)
2. [Make the new release on
   GitHub](https://github.com/mozilla/fx-private-relay-add-on/releases/new)
   * Use the version number for "Tag version" and "Release title"
   * Release notes: copy the output of `git log --no-merges --pretty=format:"%h %s" <previous-version>..<new-version>`
   * Attach binaries: select the signed `.xpi` file

