# Mint 2.0 - Authenticator Extension

Mint 2.0 is a lightweight, secure Chrome Extension for generating Time-based One-Time Passwords (TOTP). It serves as a desktop alternative to mobile authenticator apps, allowing you to manage your 2FA codes directly from your browser.

## Features

- **Standard TOTP Generation**: Fully compatible with RFC 6238 (used by Google Authenticator, Authy, etc.).
- **Cross-Device Sync**: Uses `chrome.storage.sync` to securely synchronize your accounts across all Chrome instances logged into your Google account.
- **QR Code Scanning**: Built-in QR code scanner to easily add accounts from your screen.
- **Manual Entry**: Option to manually enter Base32 secrets.
- **Privacy Focused**: Secrets are stored in your personal Chrome sync storage. No third-party servers involved.
- **Dark Mode**: Sleek, user-friendly interface.

## Installation

Currently, Mint 2.0 is available as an unpacked extension.

1.  **Clone or Download** this repository to your local machine.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable **Developer mode** in the top right corner.
4.  Click **Load unpacked**.
5.  Select the directory containing `manifest.json` (the root of this repo).
6.  The **Mint 2.0** icon should appear in your toolbar.

## Usage

### Adding an Account

**Option 1: Scan QR Code**
1.  Open the Mint extension popup.
2.  Click the **Add (+)** button.
3.  Point your webcam at a QR code, or ensure a QR code is visible on your screen (if screen capture features are added in future updates - currently uses camera).
    *   *Note: The current version uses `Html5Qrcode` which typically requests camera access.*

**Option 2: Manual Entry**
1.  Open the Mint extension popup.
2.  Click the **Add (+)** button.
3.  Enter a **Name** for the account (e.g., "GitHub").
4.  Enter the **Secret Key** provided by the service (usually a Base32 string).
5.  Click **Save**.

### Viewing Codes
1.  Click the extension icon.
2.  You will see a list of your saved accounts.
3.  Click **View** next to an account to reveal its current 6-digit TOTP code.
4.  The code refreshes automatically every 30 seconds.

### Deleting an Account
1.  In the account list, click the **Delete** button next to the account you wish to remove.
2.  Confirm the action if prompted (currently immediate deletion).

## Technical Details

This extension is built as a Single Page Application (SPA) within the extension popup.

-   **Manifest V3**: Compliant with the latest Chrome Extension standards.
-   **Architecture**: See [spa.md](spa.md) for a detailed breakdown of the `spa.js` controller and internal logic.
-   **Libraries**:
    -   `jsqr.js` & `html5-qrcode`: For QR code parsing.
    -   `spa.js`: Custom lightweight framework for routing and TOTP generation.

## Development

To modify or build upon this extension:

1.  Make changes to `spa.js`, `style.css`, or `popup.html`.
2.  Go to `chrome://extensions/`.
3.  Find **Mint 2.0** and click the **Refresh** (circular arrow) icon.
4.  Open the popup to test your changes.

## License

[MIT License](LICENSE)
