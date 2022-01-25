# Relay Extension Authentication
The Relay add-on uses the [`identity.launchWebAuthFlow` API][mdn-webauthflow]
to perform an OAuth2 flow with [the FXA OAuth service][fxa-oauth], including
[PKCE][fxa-pkce].

After the OAuth flow is complete, the add-on has an FXA access token and a
long-living FXA refresh token, and authenticates all requests to the Relay
server by including an `Authorization: Token {fxa-access-token}` header in all
API requests. The Relay server checks the token against [the FXA OAuth `/verify`
endpoint][fxa-oauth-token-verify].


## TODOs
* Extension: Update all server requests to use new auth token.
  * Note: The server requests seem a bit messy, maybe this is the time to add a
    new `src/js/shared/api.js` module?
* Extension: Automatically refresh the access token when/before it expires.
* Server: Cache the token verification check so we don't hit FXA on every
  client request.

[mdn-webauthflow]: https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/API/identity/launchWebAuthFlow 
[fxa-oauth]: https://github.com/mozilla/fxa/blob/main/packages/fxa-auth-server/docs/oauth/api.md
[fxa-pkce]: https://github.com/mozilla/fxa/blob/main/packages/fxa-auth-server/docs/oauth/pkce.md
[fxa-oauth-token-verify]: https://github.com/mozilla/fxa/blob/main/packages/fxa-auth-server/docs/oauth/api.md#post-v1verify
