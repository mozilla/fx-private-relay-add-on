
Summary
-------

This document outlines how to submit and release the Firefox Relay add-on to AMO.

**📝 Mana Page:** [https://mana.mozilla.org/wiki/pages/viewpage.action?spaceKey=SECPRV&title=Firefox+Relay+Add-on+Submission+Process](https://mana.mozilla.org/wiki/pages/viewpage.action?spaceKey=SECPRV&title=Firefox+Relay+Add-on+Submission+Process)

**📹 Video Demo:** [https://mozilla.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=4145870c-87de-4e0d-b9be-aea7010b8ef2](https://mozilla.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=4145870c-87de-4e0d-b9be-aea7010b8ef2)

  

**Submitting a Request form to AMO**
------------------------------------

* * *

Make sure to use **[this form](https://mana.mozilla.org/wiki/pages/viewpage.action?spaceKey=FDPDT&title=Mozilla+Add-on+Review+Requests+Intake)** from AMO when updating the add on. Select “Submit an updated add on”. This will generate a Jira ticket.

  
**Fields to fill out:**

Add-on name: Firefox Relay

Add-on ID: private-relay@firefox.com

Description of the add-on purpose and features: Firefox Relay lets you generate email aliases that forward to your real inbox. Use it to hide your real email address and protect yourself from hackers and unwanted mail.

Add-on owner individual: [Maxx Crawford](/wiki/display/~mcrawford@mozilla.com) (mcrawford@mozilla.com)

Code repository location: [https://github.com/mozilla/fx-private-relay-add-on/](https://github.com/mozilla/fx-private-relay-add-on/)

Type of add-on (Regular or Privileged): Regular

Confirmation that add-on has been checked for Add-on Policies compliance by the developer: NIL

Data collection description and Data review request if applicable: NIL

Release schedule for this submission: [Fill out intended release date here]

Note: Make sure to give the AMO team **at least a week** from the time the form has been submitted to review the submission.

Intended distribution (AMO or Self-hosted): AMO


**Releasing to AMO
**
------------------------------------------

* * *

### Step 1: Make the new version

1.  Bump the version number in 3 files. [Here's an example PR](https://github.com/mozilla/fx-private-relay-add-on/pull/375/files).  
    1.  `package.json`
    2.  `package-lock.json`
    3.  `manifest.json`
2.  Commit the version number bump
3.  Create a git tag for the version: `git tag <version>`
4.  Push the tag up to GitHub: `git push --tags`

### Step 2: Add the release notes
------------------------------------------

1.  Run the line below to copy the changelog onto your clipboard. If you're on Windows, use `clip` instead of `pbcopy`
    
       ` git log --no-merges --pretty=format:"%h %s" \[previous version number\]..\[updated version number\] | pbcopy `
    
    **Example:** if updating from 2.4.0 to 2.4.1 , then run: ` git log --no-merges --pretty=format:"%h %s" 2.4.0..2.4.1 | pbcopy `
    
      
    
2.  Go to the [releases page](https://github.com/mozilla/fx-private-relay-add-on/releases)
3.  Select ‘Draft a new release’
4.  Select the newly created tag
5.  Paste the generated list of commits from your clipboard onto the description field
6.  Clean up the list of commits. Only leave out commits that are significant to the pre-release. For example, remove submodule commits from the list.
7.  Select “This is a pre-release” checkbox and publish release.



### Step 3: Configure and generate add on zip files for Firefox
------------------------------------------


1.  Make sure you checkout the newest verison: run `git checkout <version number>`
2.  Run `npm run config:prod` to configure the add on
3.  Run `npm run build:prod` to generate the add on for **Firefox**
5.  In the /`web-ext-artifacts` folder, you should be able to find a zip file of the new release.

        Tip: The `package.json` file has a list of other command helpful command lines


###   Step 4: Submitting to AMO
------------------------------------------

1. Make sure that you have access to edit 'Firefox Relay' on the [AMO developers page](https://addons.mozilla.org/en-US/developers/addons). Contact Maxx Crawford for file access.

2. Make sure that you have publishing rights granted by AMO themselves (reach out to Andreas Wagner)

  
3. Go to [https://addons.mozilla.org/en-US/developers/addon/private-relay/edit](https://addons.mozilla.org/en-US/developers/addon/private-relay/edit) and select **“Upload new version”** on the left side bar

4. **IMPORTANT:** Make sure to select “**Change**” under Where to Host Version and select “**On this site**”.

        **WARNING:** If the add on is submitted while set to "_On your own_", you will need to bump the version number (see Step 1: Make the new version) and redo the entire process. This is because version numbers are unique and cannot simply be deleted and edited.

5. Upload the generated zip file in the `/web-ext-artifacts` folder beginning with `firefox_relay` . Do not submit the zip file intended for Chrome.

6. On “Do You Need to Submit Source Code?” Select "**No**"

7. Summarize the changelog into release notes.

        Note: Only request that the AMO reviewer coordinate with either Maxx Crawford or Tony Cinotto when approving if release date is sensitive. For example, if there is a certain date for marketing.


  
  
