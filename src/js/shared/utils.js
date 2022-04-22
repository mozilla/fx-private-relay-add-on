/* exported areInputIconsEnabled setCustomFonts preventDefaultBehavior */

// eslint-disable-next-line no-redeclare
async function areInputIconsEnabled() {
  const { showInputIcons } = await browser.storage.local.get("showInputIcons");
  if (!showInputIcons) {
    browser.storage.local.set({ "showInputIcons" : "show-input-icons"})
    return true;
  }
  return (showInputIcons === "show-input-icons");
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
    if (doesFontExist) { break; }

    const fontPath = browser.runtime.getURL(customFont.filePath)
    const font = new FontFace(customFont.font, `url(${fontPath})`);
    font.weight = customFont.weight;
    await font.load();
    document.fonts.add(font);      
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
