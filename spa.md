## spa.js — Single-page app and TOTP helper

This document describes `spa.js`, the small SPA controller and TOTP helper used by the Mint Chrome extension popup. It explains what the file does, the public functions it exposes (conceptually), the storage/data contract, how to use and test the features, common edge cases, and recommended improvements.

### Purpose

- Manage simple single-page navigation inside the extension popup using `location.hash` (emulates an SPA).
- Provide TOTP generation (RFC 6238-like) from a Base32 secret using the Web Crypto API.
- Provide simple UI wiring for listing accounts, viewing a generated TOTP for an account, and adding new accounts (including QR scan via Html5Qrcode).

### Where this runs

- The code runs in the extension popup context (see `popup.html` in the repository). It expects DOM elements with IDs `page-list`, `page-view`, and `page-add` to be present and acts on them.

### High-level flow

- On page load and on `hashchange`, `showPage(location.hash)` is called to determine which internal page to render.
- Supported hashes:
  - default or `#list` → list of accounts (calls `loadListPage()`)
  - `#add` → add page (calls `loadAddPage()`)
  - `#view/:name` → view TOTP for account `name` (calls `loadViewPage(name)`)

### Data / storage contract

- The code uses `chrome.storage.sync` and expects to store keys under an object named `keys`.
- Shape:

  {
    keys: {
      "Account Name": "BASE32SECRET",
      "Other": "ANOTHERSECRET"
    }
  }

- Secrets are plain Base32 strings (no explicit prefix like `otpauth://` required for the manual-add UI). The QR scanner expects to parse an `otpauth://` URL and will extract the `secret` query parameter and the account name from the path.

### Important functions (conceptual API)

- showPage(hash)
  - Inputs: a hash string from `location.hash`.
  - Behavior: hides all `div` elements with IDs starting `page-` then shows the appropriate page and triggers its loader.

- loadListPage()
  - Reads `chrome.storage.sync.get({ keys: {} })` and renders each stored account with View and Delete buttons. Adds an "Add New" button to navigate to `#add`.

- loadViewPage(name)
  - Parameters: `name` (string) — account name.
  - Behavior: loads secret from storage, calls `generateTOTP(secret)` and updates the DOM element with id `code`. Starts an interval to refresh the code every 30 seconds.
  - Note: the current implementation starts an interval but does not stop it when navigating away — see improvements.

- loadAddPage()
  - Renders a small form for `key-name` and `key-secret`, a Save button, and a QR reader area (`Html5Qrcode` usage).
  - On save, stores the key in `chrome.storage.sync` and navigates back to `#list`.
  - On successful QR scan, extracts `secret` and account `name` from an `otpauth://` URL and stores them.

- deleteKey(name)
  - Removes a key from the `keys` object in `chrome.storage.sync` and reloads the extension popup on completion.

- generateTOTP(secret) -> Promise<string>
  - Inputs: `secret` (string, Base32 encoded)
  - Behavior: converts Base32 to bytes, creates a HMAC-SHA1 with the 8-byte time counter (30s step) and returns a 6-digit string (zero-padded) via a Promise.
  - Uses the Web Crypto API (crypto.subtle.importKey + sign).

- base32ToBytes(base32) -> Uint8Array
  - Converts a Base32-encoded string to a byte array. Non-alphabet characters are stripped and padding `=` is removed.

### Usage examples

- Navigate to the view page for an account named "Acme":

  - Set `location.hash = '#view/' + encodeURIComponent('Acme')` or click the View button.

- Call TOTP generator in console (devtools) for quick check:

  generateTOTP('JBSWY3DPEHPK3PXP').then(code => console.log(code));

  (This returns a Promise resolving to a 6-digit string. Replace the secret with yours.)

### Dependencies

- Html5Qrcode (used in `loadAddPage` to scan QR codes).
- Web Crypto API (`crypto.subtle`) for HMAC-SHA1 signing. This is available in modern browsers and extension popups.
- chrome.storage.sync (Chrome extension API).

### Edge cases and failure modes

- Invalid Base32 secret:
  - `base32ToBytes` removes non-Base32 chars; if the string is malformed the conversion may produce an incorrect byte array and `generateTOTP` will still attempt to compute an HMAC. Consider validating length and allowed characters and surfacing an error to the user.

- Missing secret for a viewed account:
  - `loadViewPage` should handle `undefined`/`null` secrets and display an error instead of "Loading...".

- Camera/QR issues:
  - If no cameras are available `Html5Qrcode.getCameras()` returns an empty array — the code currently does nothing in that case. Consider showing a helpful message and disabling the QR UI.

- Intervals left running:
  - `loadViewPage` creates a `setInterval` but does not clear it when navigating away. That will leak intervals if the user opens multiple view pages. Consider storing the interval id and clearing it when `showPage` hides `page-view` or before starting a new interval.

- Time sync:
  - TOTP depends on the system clock. If the host clock is wrong, codes will differ from the server-side expectation.

### Security notes

- Secrets are stored in `chrome.storage.sync` in clear text. This syncs to the user's Google account. If you need stronger protection consider encrypting secrets before storage or using local-only storage (`chrome.storage.local`) and/or a passphrase.

- The copy-to-clipboard action uses `navigator.clipboard.writeText` — extension pages have clipboard permissions, but be mindful when copying sensitive codes (they remain in clipboard history until overwritten).

### Tests / manual checks to perform

1. Start the extension popup. It should show the list page with accounts from `chrome.storage.sync`.
2. Add a new entry manually using the Add UI. Confirm it appears in the list.
3. Use a known Base32 secret (from an authenticator seed) and `generateTOTP` in console to validate code generation.
4. Test QR scanning on a device with a camera: scan a typical `otpauth://totp/Label:Account?secret=SECRET&issuer=Label` URL and confirm the account is added.

### Suggested improvements (low-risk)

- Clear the TOTP refresh interval when leaving the view page.
- Add input validation and user feedback (invalid secret, empty name).
- Show a countdown to the next 30s tick and optionally a progress ring.
- Add error handling and messages for camera not available and for storage `chrome.runtime` failures.
- Consider switching to `chrome.storage.local` or encrypting secrets before syncing across devices.

---

Files changed
- `spa.md` — Documentation for `spa.js` (this file).

If you'd like, I can also:
- Add inline JSDoc comments directly into `spa.js`.
- Update `README.md` to link to this new `spa.md`.
- Implement the suggested interval cleanup and basic validation.
