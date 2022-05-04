// This looks for <firefox-private-relay-addon></firefox-private-relay-addon> and
// updates the dataset. The Private Relay website watches for this change, and
// makes content changes if the addon has been installed.

(async () => {  

  let hasupdateAddOnAuthStatusRun = false;
  
  // BUG: Because the <firefox-private-relay-addon> dataset is initially set as false, 
  // there's a baked-in race condition to automatically mark the user as "logged out".
  // This setTimeout logic will only complete if the <firefox-private-relay-addon> userLoggedIn
  // data attribute does not change from False to True, signlaing to the add-on that the user is actually logged out. 
  // Note that this creates a different race condition between a user logging out and then closing the browser. 
  const runUpdateAddOnAuthStatus = setTimeout( async ()=> {
    await updateAddOnAuthStatus();
  }, 5000);

  async function updateAddOnAuthStatus() {

    // Clear the default run() function.
    clearTimeout(runUpdateAddOnAuthStatus);

    // Catch any extra calls updateAddOnAuthStatus() after it runs once.
    if (hasupdateAddOnAuthStatusRun) { return; }

    hasupdateAddOnAuthStatusRun = true;
    const isLoggedIn = document.querySelector("firefox-private-relay-addon").dataset.userLoggedIn;
    await browser.runtime.sendMessage({
      method: "updateAddOnAuthStatus",
      status: isLoggedIn,
    });
  }

  const dahsboardInitializationObserver = new MutationObserver((mutations) => {
    
    // Listen to <firefox-private-relay-addon> element for dataset changes
    mutations.forEach(async (mutation)=> {
      if (mutation.attributeName === 'data-user-logged-in') {
        await run();
        dahsboardInitializationObserver.disconnect();
      }
    });
  });
  if (document.querySelector("firefox-private-relay-addon").dataset.userLoggedIn === "False") {
    // Watch the <firefox-private-relay-addon> element if the user is not logged in
    dahsboardInitializationObserver.observe(document.querySelector("firefox-private-relay-addon"), {
      attributes: true, 
      childList: false, 
      characterData: false
    });
  } else {
    await run();
  }

  // Init function
  async function run() {
    await updateAddOnAuthStatus();
  }
  
})();
