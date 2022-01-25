"use strict";

function generatePKCECodeVerifierValue() {
  /*
   * A code verifier is a random string using characters of
   * [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~",
   * with a minimum length of 43 characters and a maximum length of 128 characters.
   */
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < Math.random() * (128 - 43) + 43; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
}


async function pkceCodeChallengeB64(pkceCodeVerifierValue){
  const pkceCodeChallengeDigest = await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(pkceCodeVerifierValue)
  );
  const b64EncodedChallenge = btoa(String.fromCharCode(...new Uint8Array(pkceCodeChallengeDigest)))
  return b64EncodedChallenge.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}


document.addEventListener("DOMContentLoaded", async () => {
  const { relaySiteOrigin } = await browser.storage.local.get("relaySiteOrigin");
  const fxaAuthBaseUrl = 'https://oauth.stage.mozaws.net/v1';
  const clientID = '0d134b18b51f173e';


  document.addEventListener("focus", () => {
    enableDataOptOut();
  });

  enableDataOptOut();

  const oauthEntryPoints = document.querySelectorAll(".open-oauth");
  oauthEntryPoints.forEach(el => {
    el.addEventListener("click", async(e) => {
      e.preventDefault();
      sendRelayEvent("First Run", "click", e.target.dataset.eventLabel);
      const authUrl = `${fxaAuthBaseUrl}/authorization`;
      const scope = 'profile';
      const accessType = 'offline';
      const redirectUrl = browser.identity.getRedirectURL();
      const state = Math.random().toString(36).substr(2);
      const pkceCodeVerifier = generatePKCECodeVerifierValue();
      console.log(`pkceCodeVerifier: ${pkceCodeVerifier}`);
      const pkceCodeChallenge = await pkceCodeChallengeB64(pkceCodeVerifier);
      console.log(`pkceCodeCallenge: ${pkceCodeChallenge}`);
      const fullAuthUrl = `${authUrl}?client_id=${clientID}&scope=${scope}&access_type=${accessType}&redirect_uri=${redirectUrl}&state=${state}&code_challenge_method=S256&code_challenge=${pkceCodeChallenge}&response_type=code`;
      console.log(`fullAuthUrl: ${fullAuthUrl}`);
      browser.identity.launchWebAuthFlow({
        url: fullAuthUrl,
        interactive: true
      }).then(async (result) => {
        console.log(`launchWebAuthFlow result: ${result}`);
        const resultUrl = new URL(result);
        const resultState = resultUrl.searchParams.get('state');
        if (resultState !== state) {
          return;
        }
        console.log(`state matches; continuing ...`);
        const code = resultUrl.searchParams.get('code');
        console.log(`oauth code: ${code}`);
        const tokenUrl = `${fxaAuthBaseUrl}/oauth/token`;
        console.log(`redeeming code for token: ${tokenUrl}`);
        const tokenResponse = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            client_id: clientID,
            code: code,
            code_verifier: pkceCodeVerifier,
          })
        })
        console.log(`tokenResponse from FXA: ${tokenResponse}`);
        const fxaTokenData = await tokenResponse.json();
        console.log(`fxaTokenData: ${fxaTokenData}`);
        await browser.storage.local.set({fxaTokenData});
        console.log(`set token into browser.storage.local`);
        browser.runtime.sendMessage({
          method: "loadAliasesFromServerIntoStorage"
        });
      });
    });
  });

});
