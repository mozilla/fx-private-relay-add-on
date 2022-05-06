/**
 * This function is only executed on the Relay homepage,
 * which is only loaded when the user is not logged in - otherwise, the server
 * will send a 302 redirect to /accounts/profile.
 * Hence, if this script runs, we know the user is logged out.
 */
browser.runtime.sendMessage({
  method: "updateAddOnAuthStatus",
  status: false,
});
