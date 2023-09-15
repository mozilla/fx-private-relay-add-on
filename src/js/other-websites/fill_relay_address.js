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
  // 'change' event, is needed to trigger the change event listeners (i.e this event is needed when 
  // clicking a mask from the relay button, instead of typing it, since change events run when the input is out of focus (input events don't))
  // https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/change_event
  emailInput.dispatchEvent(new Event('change', {bubbles:true}));
}

function fillInputWithRelayNumber(emailInput, relayNumber) {

  // BUG: Duplicate fillInputWithAlias calls without proper input content
  // The relayNumber/emailInput arguments check below is a work-around to let the duplicate call(s) fail silently.
  // To debug, check all instances where fillInputWithRelayNumber() is being called and isolate it.
  if (!emailInput || !relayNumber) {
    return false;
  }

  // Set the value of the target field to the mask number
  const normalisedNumber = relayNumber.number.startsWith("+1")
    ? relayNumber.number.substr(2)
    : relayNumber.number;
  emailInput.value = normalisedNumber;

  emailInput.dispatchEvent(new Event('input', {bubbles:true}));
  emailInput.dispatchEvent(new Event('change', {bubbles:true}));
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
  // These messages are sent by the context menu, not the in-page popup:
  if (message.type === "fillTargetWithRelayAddress") {    

    // COMPATIBILITY NOTE: getTargetElement() not available on Chrome contextMenus API
    const emailInput = browser.menus ? browser.menus.getTargetElement(message.targetElementId): clickedEl;
    fillInputWithAlias(emailInput, message.relayAddress);
  }
  if (message.type === "fillTargetWithRelayNumber") {

    // COMPATIBILITY NOTE: getTargetElement() not available on Chrome contextMenus API
    const emailInput = browser.menus ? browser.menus.getTargetElement(message.targetElementId): clickedEl;
    fillInputWithRelayNumber(emailInput, message.relayNumber);
  }
});



