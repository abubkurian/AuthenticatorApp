

// Manage page navigation using the browser’s hash (location.hash) to simulate a single-page application (SPA)
/**
 * spa.js
 * --------
 * Lightweight single-page navigation and TOTP generation helpers for the Mint
 * Chrome extension popup.
 *
 * This file assumes the popup has three container elements with the following
 * IDs: `page-list`, `page-view`, and `page-add`.
 */

/**
 * Show the correct page based on a location hash.
 *
 * Supported hashes:
 * - `#list` (or empty): shows the accounts list
 * - `#add`: shows the add-account page
 * - `#view/<name>`: shows the TOTP view for account `name`
 *
 * @param {string} hash - The location.hash string (including the leading '#').
 */

const routes = {
  "#list": { page: "page-list", loader: loadListPage },
  "#addnew": { page: "page-add", loader: loadAddPage },
  "#view": { page: "page-view", loader: loadViewPage },
  // "#settings": { page: "page-settings", loader: loadSettingsPage }
};


// function to show the correct page based on the hash

function showPage(hash) {
  // Hide all pages
  document.querySelectorAll("div[id^=page-]").forEach(div => div.style.display = "none");

  // Handle special "view" route with dynamic name
  if (hash.startsWith("#view/")) {
    const name = decodeURIComponent(hash.split("/")[1]);
    loadViewPage(name);
    document.getElementById("page-view").style.display = "block";
    return;
  }

  // Match known route or default to "#list"
  const route = routes[hash] || routes["#list"];

  // Load content (if loader exists)
  if (typeof route.loader === "function") {
    route.loader();
  }

  // Show corresponding page (if element exists)
  const pageEl = document.getElementById(route.page);
  if (pageEl) {
    pageEl.style.display = "block";
  } else {
    console.warn(`Page element not found: ${route.page}`);
  }
}



// ... loadListPage, loadViewPage, loadAddPage will be added next ...

/**
 * Generate a TOTP code from a Base32 secret using HMAC-SHA1.
 *
 * Implementation notes:
 * - Uses 30-second time steps (standard TOTP)
 * - Returns a Promise resolving to a zero-padded 6-digit string
 * - Uses the Web Crypto API (crypto.subtle.importKey + sign)
 *
 * @param {string} secret - Base32-encoded secret (case-insensitive, padding `=` allowed)
 * @returns {Promise<string>} Promise resolving to a 6-digit TOTP string
 */
function generateTOTP(secret) {
  const key = base32ToBytes(secret);
  const epoch = Math.floor(Date.now() / 1000);
  const time = Math.floor(epoch / 30);
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint32(4, time);
  return crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]).then(cryptoKey =>
    crypto.subtle.sign("HMAC", cryptoKey, buffer).then(signature => {
      const bytes = new Uint8Array(signature);
      const offset = bytes[bytes.length - 1] & 0xf;
      const binary = ((bytes[offset] & 0x7f) << 24) |
        ((bytes[offset + 1] & 0xff) << 16) |
        ((bytes[offset + 2] & 0xff) << 8) |
        (bytes[offset + 3] & 0xff);
      const otp = binary % 1000000;
      return otp.toString().padStart(6, '0');
    })
  );
}

/**
 * Convert a Base32-encoded string to a Uint8Array of bytes.
 * Non-alphabet characters are stripped and padding `=` is ignored.
 *
 * @param {string} base32 - Base32 string (A-Z2-7, optionally padded)
 * @returns {Uint8Array} decoded bytes
 */
function base32ToBytes(base32) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = base32.replace(/=+$/, "").toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = "";
  for (let char of clean) {
    const val = alphabet.indexOf(char);
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}


// First page to load. Shows list of accounts added.

/**
 * Render the accounts list page.
 *
 * Reads `keys` from `chrome.storage.sync` and renders each account with a
 * View and Delete button. Adds an "Add New" button at the bottom.
 */
function loadListPage() {
  const container = document.getElementById("page-list");
  container.innerHTML = "<img id=\"myc\" src=\"images/Title Logo.png\" alt=\"Mint Your Code\"> <h3>Accounts</h3>";
  chrome.storage.sync.get({ keys: {} }, (data) => {

    // all the keys stored in the storage is loaded here
    const keys = data.keys;
    for (const name in keys) {
      const div = document.createElement("div");
      const viewBtn = document.createElement("button");
      const deleteBtn = document.createElement("button");

      div.textContent = name;
      viewBtn.textContent = "View";
      deleteBtn.textContent = "Delete";

      viewBtn.addEventListener("click", () => {
        location.hash = `#view/${encodeURIComponent(name)}`;
      });

      deleteBtn.addEventListener("click", () => {
        deleteKey(name);
      });

      div.appendChild(viewBtn);
      div.appendChild(deleteBtn);
      container.appendChild(div);

    }
    const addBtn = document.createElement("button");
    addBtn.textContent = "Add New";
    addBtn.onclick = () => location.hash = "#addnew";
    container.appendChild(addBtn);
  });
}

/**
 * Delete a stored key after a confirmation prompt.
 *
 * @param {string} name - Account name to delete
 */
function deleteKey(name) {
  if (confirm("Delete " + name + "?")) {
    chrome.storage.sync.get({ keys: {} }, (data) => {
      const keys = data.keys;
      delete keys[name];
      chrome.storage.sync.set({ keys }, () => location.reload());
    });
  }
}

/**
 * Render the view page for a given account and start updating the TOTP every
 * 30 seconds.
 *
 * NOTE: The implementation starts an interval but does not currently clear it
 * when navigating away. Consider improving this to avoid leaking intervals.
 *
 * @param {string} name - Account name to view
 */
function loadViewPage(name) {
  const container = document.getElementById("page-view");
  container.innerHTML = "<h3>" + name + "</h3><div id='code'>Loading...</div><button id='copy'>Copy</button><br><button <button id='back-btn'>Back</button>";
  chrome.storage.sync.get({ keys: {} }, (data) => {
    const secret = data.keys[name];
    const updateCode = () => {
      generateTOTP(secret).then(code => {
        document.getElementById("code").textContent = code;
      });
    };
    const interval = setInterval(updateCode, 30000); // Update every 30s
    updateCode(); // Run once immediately

  });
  document.getElementById("copy").onclick = () => {
    const code = document.getElementById("code").textContent;
    navigator.clipboard.writeText(code);
  };
  document.getElementById("back-btn").addEventListener("click", () => {
    location.hash = "#list";
  });

}



/*
 * Render the add page which provides manual entry fields and a QR scanner.
 *
 * On save (or successful QR scan) the new key is stored under `keys[name]` in
 * `chrome.storage.sync` and the UI navigates back to the list page.
 */


function loadAddPage() {
  const container = document.getElementById("page-add");
  container.innerHTML = `
    <h3>Add TOTP Key</h3>
    <input type="text" id="key-name" placeholder="Account name"><br>
    <input type="text" id="key-secret" placeholder="Secret"><br>
    <button id="save-btn">Save</button>
    <button id="back-btn">Back</button><br>
    <input type="file" id="qr-upload" accept="image/*"><br>
    <div id="reader" style="width: 220px; display:none;"></div>
    <p id="qr-status"></p>

  `;

  document.getElementById("qr-upload").addEventListener("change", handleQrUpload);
  document.getElementById("save-btn").addEventListener("click", saveManualKey);
  document.getElementById("back-btn").addEventListener("click", () => {
    location.hash = "#list";
  });


}


// Save manually typed key
function saveManualKey() {
  const name = document.getElementById("key-name").value.trim();
  const secret = document.getElementById("key-secret").value.trim();

  if (!name || !secret) return;

  chrome.storage.sync.get({ keys: {} }, (data) => {
    const keys = data.keys;
    keys[name] = secret;
    chrome.storage.sync.set({ keys }, () => {
      location.hash = "#list";
    });
  });
}


function handleQrUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const img = new Image();
  const reader = new FileReader();

  reader.onload = () => {
    img.src = reader.result;
    img.onload = () => decodeQrFromImage(img);
  };

  reader.readAsDataURL(file);
}

function decodeQrFromImage(img) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = img.width;
  canvas.height = img.height;

  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const code = jsQR(imageData.data, canvas.width, canvas.height);

  if (!code) {
    document.getElementById("qr-status").textContent = "Could not read QR code.";
    return;
  }

  parseOtpAuthUri(code.data);
}

function parseOtpAuthUri(uri) {
  if (!uri.startsWith("otpauth://totp/")) {
    document.getElementById("qr-status").textContent = "Invalid TOTP QR.";
    return;
  }

  const withoutPrefix = uri.replace("otpauth://totp/", "");
  const [label, query] = withoutPrefix.split("?");

  const params = new URLSearchParams(query);
  const secret = params.get("secret");
  const issuer = params.get("issuer");

  let name = decodeURIComponent(label);
  if (issuer && !name.includes(issuer)) {
    name = issuer + " (" + name + ")";
  }

  if (!secret) {
    document.getElementById("qr-status").textContent = "QR missing secret.";
    return;
  }

  document.getElementById("key-name").value = name;
  document.getElementById("key-secret").value = secret;

  document.getElementById("qr-status").textContent = "QR data loaded.";
}






// Auto-handle hash changes & initial load
window.addEventListener("hashchange", () => showPage(location.hash));
window.addEventListener("load", () => showPage(location.hash || "#list"));
