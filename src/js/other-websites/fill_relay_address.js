// eslint-disable-next-line no-redeclare
function fillInputWithAlias(emailInput, relayAlias) {
  // BUG: Duplicate fillInputWithAlias calls without proper input content
  // The relayAlias/emailInput arguments check below is a work-around to let the duplicate call(s) fail silently. 
  // To debug, check all instances where fillInputWithAlias() is being called and isolate it. 
  if (!emailInput || !relayAlias) {
    return false;
  }

  switch (relayAlias.domain) {
    case 1:
      emailInput.value = relayAlias.address + "@relay.firefox.com";
      break;
    case 2:
      emailInput.value = relayAlias.address + "@mozmail.com";
      break;
    default:
      // User does not sync data so no relayAlias.domain is available
      emailInput.value = relayAlias.address
      break;
  }

  console.log(emailInput);
  
  emailInput.dispatchEvent(
    new Event("focusin")
  );

  console.log("emailInput");

  emailInput.value = relayAlias.address;


  emailInput.dispatchEvent(
    new InputEvent("relay-address", {
      inputType: "insertFromPaste",
      data: relayAlias.address,
      isComposing: true
    })
  );

  emailInput.blur();

  emailInput.dispatchEvent(
    new Event("change")
  );

  
}


// COMPATIBILITY NOTE: browser.menus.getTargetElement is not available so 
// we have to listen for any contextmenu click to determe the target element.
// https://stackoverflow.com/a/7704392
let clickedEl = null;

// Only listen if on Chrome
if (!browser.menus) {
  document.addEventListener("contextmenu", function(event){
      clickedEl = event.target;
  }, true);
}

browser.runtime.onMessage.addListener((message, sender, response) => {
  if (message.type === "fillTargetWithRelayAddress") {    

    // COMPATIBILITY NOTE: getTargetElement() not available on Chrome contextMenus API
    const emailInput = browser.menus
          ? browser.menus.getTargetElement(message.targetElementId)
          : clickedEl
    return fillInputWithAlias(emailInput, message.relayAddress);
  }
});
