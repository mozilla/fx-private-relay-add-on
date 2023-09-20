/* exported areInputIconsEnabled isPwdMgrCompatEnabled setCustomFonts preventDefaultBehavior checkWaffleFlag getBrowser */

// eslint-disable-next-line no-redeclare
async function areInputIconsEnabled() {
  const { showInputIcons } = await browser.storage.local.get("showInputIcons");
  if (!showInputIcons) {
    browser.storage.local.set({ "showInputIcons" : "show-input-icons"})
    return true;
  }
  return (showInputIcons === "show-input-icons");
}

// eslint-disable-next-line no-redeclare
async function isPwdMgrCompatEnabled() {
  const { pwdMgrCompat } = await browser.storage.local.get("pwdMgrCompat");
  if (!pwdMgrCompat) {
    browser.storage.local.set({ "showInputIcons" : "pwdmgr-compat-enabled"})
    return true;
  }
  return (pwdMgrCompat === "pwdmgr-compat-enabled");
}

// This function is defined as global in the ESLint config _because_ it is created here:
// eslint-disable-next-line no-redeclare
async function setCustomFonts() {
  const customFonts = [
    { font: "Metropolis Bold", weight: 800, filePath: "/fonts/Metropolis/Metropolis-Bold.woff2"},
    { font: "Metropolis Medium", weight: 500, filePath: "/fonts/Metropolis/Metropolis-Medium.woff2"},
    { font: "Metropolis Light", weight: 300, filePath: "/fonts/Metropolis/Metropolis-Light.woff2"},
    { font: "InterUI Regular", weight: 300, filePath: "/fonts/Inter/Inter-UI-Regular.woff2"},
  ];
  
  for (const customFont of customFonts) {

    // Check if the font has already been loaded
    const doesFontExist = document.fonts.check(`16px ${customFont.font}`);
    if (!doesFontExist) {
      const fontPath = browser.runtime.getURL(customFont.filePath)
      const font = new FontFace(customFont.font, `url(${fontPath})`);
      font.weight = customFont.weight;
      await font.load();
      document.fonts.add(font);   
    }
  }
}

// This function is defined as global in the ESLint config _because_ it is created here:
// eslint-disable-next-line no-redeclare
function preventDefaultBehavior(clickEvt) {
  clickEvt.stopPropagation();
  clickEvt.stopImmediatePropagation();
  clickEvt.preventDefault();
  return;
}

// eslint-disable-next-line no-unused-vars
async function checkWaffleFlag(flag) {
  const waffleFlagArray = (await browser.storage.local.get("waffleFlags")).waffleFlags.WAFFLE_FLAGS;
  for (let i of waffleFlagArray) {
    if (i[0] === flag && i[1] === true) {
      return true;
    }
  }
  return false;
}

// eslint-disable-next-line no-unused-vars
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
