// eslint-disable-next-line no-redeclare
function fillInputWithAlias(emailInput, relayAlias) {

  // BUG: Duplicate fillInputWithAlias calls without proper input content
  // The relayAlias/emailInput arguments check below is a work-around to let the duplicate call(s) fail silently. 
  // To debug, check all instances where fillInputWithAlias() is being called and isolate it. 
  if (!emailInput || !relayAlias) {
    return false;
  }

  // If this is a newly created relayAlias, it will be an object with lots of info to parse. 
  // Otherwise, it's a reused mask, so it's just the email address. 
  const emailMask = (relayAlias.full_address) ? relayAlias.full_address : relayAlias.address

  // Set the value of the target field to the selected/generated mask
  emailInput.value = emailMask;

  emailInput.dispatchEvent(new Event('input', {bubbles:true}));

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

browser.runtime.onMessage.addListener((message, _sender, _response) => {
  if (message.type === "fillTargetWithRelayAddress") {    

    // COMPATIBILITY NOTE: getTargetElement() not available on Chrome contextMenus API
    const emailInput = browser.menus ? browser.menus.getTargetElement(message.targetElementId): clickedEl;
    // console.log(emailInput.value);

     fillInputWithAlias(emailInput, message.relayAddress);
    // const relayMasks = message.relayAddress;
    // const emailMask = (relayMasks.full_address) ? relayMasks.full_address : relayMasks.address;

    // forceSetVal(emailInput, emailMask);

  }
});

// function forceSetVal(emailInput, emailMask) {
//   if (!emailInput || !relayAlias) {
//     return false;
//   }

//   emailInput.value = emailMask;
//   emailInput.dispatchEvent(new Event('input', {bubbles:true}));

// }