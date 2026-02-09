

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


function isPopup() {
  return window.location.pathname.includes("popup");
}

function isLinux() {
  return navigator.userAgent.toLowerCase().includes("linux");
}


// Navigational routes mapping hash to page ID and optional loader function
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

  if (hash === "#addnew" && isLinux() && isPopup()) {
    chrome.tabs.create({
      url: chrome.runtime.getURL("add.html")
    });
    location.hash = "#list";
    return;
  }

  // Handle special "view" route with dynamic name - view individual account added
  if (hash.startsWith("#view/")) {
    const name = decodeURIComponent(hash.split("/")[1]); // Extract name from hash
    loadViewPage(name);
    document.getElementById("page-view").style.display = "block";
    return;
  }

  // Match known route or default to "#list"
  const route = routes[hash] || routes["#list"]; //example --> routes["#list"] = { page: "page-list", loader: loadListPage }

  // Load content (if loader exists)
  if (typeof route.loader === "function") {
    route.loader(); // Call the loader function to populate the page
  }

  // Show corresponding page (if element exists)
  const pageEl = document.getElementById(route.page);
  if (pageEl) {
    pageEl.style.display = "block";
  }
  else {
    console.warn(`Page element not found: ${route.page}`);
  }
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

  // clear existing content and set up header
  container.innerHTML = "<img id=\"myc\" src=\"images/Title Logo.png\" alt=\"Mint Your Code\"> <h3>Accounts</h3>";


  //1. load all the keys from the storage
  chrome.storage.sync.get({ keys: {} }, (data) => {
    const keys = data.keys;

    //2. for each key, create a div with account name, code, and buttons
    for (const name in keys) {

      const secret = keys[name]; // Get secret directly from the data we already fetched

      const div = document.createElement("div");
      div.className = "account-item"; // Good for CSS styling

      const label = document.createElement("strong");
      label.textContent = name;

      const code = document.createElement("div");
      code.className = "otp-code";
      code.textContent = "Loading...";

      // Action Buttons
      const viewBtn = createBtn("View", () => location.hash = `#view/${encodeURIComponent(name)}`);
      const deleteBtn = createBtn("Delete", () => deleteKey(name));
      const fillBtn = createBtn("Fill", () => handleFill(code.textContent));

      // --- TOTP Update Logic ---
      const updateCode = () => {
        generateTOTP(secret).then(key => {
          // If generateTOTP returns null or undefined, default to "------"
          code.textContent = key || "Error";
        }).catch(err => {
          console.error("TOTP Error:", err);
          code.textContent = "Error";
        });
      };

      updateCode();
      const interval = setInterval(updateCode, 30000); // Update every 30s

      // Append elements to div

      div.append(label, code, viewBtn, deleteBtn, fillBtn);
      container.appendChild(div);

    }

    const addBtn = document.createElement("button");
    addBtn.textContent = "Add New";
    addBtn.onclick = () => {
      if (isLinux() && isPopup()) {
        chrome.tabs.create({
          url: chrome.runtime.getURL("add.html")
        });
      } else {
        location.hash = "#addnew";
      }
    };

    container.appendChild(addBtn);
  });
}


// Helper to keep the main function clean
function createBtn(text, onClick) {
  const btn = document.createElement("button");
  btn.textContent = text;
  btn.onclick = onClick;
  return btn;
}

function handleFill(currentCode) {

  // Check if the code is actually loaded
  if (currentCode === "Loading..." || currentCode === "Error") {
    console.warn("Code not ready yet.");
    return;
  }
  navigator.clipboard.writeText(currentCode);
  // Send to content script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: "fill_otp", codeNum: currentCode }, // Ensure key name matches your content script
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("Content script not found or error:", chrome.runtime.lastError.message);
          } else {
            console.log("Autofill response:", response);
          }
        }
      );
    }
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
  container.innerHTML = "<h3>" + name + "</h3><div id='code'>Loading...</div><button id='copy'>Copy</button><br><button id='fill'>Fill</button><br><button id='back-btn'>Back</button><br><button id='delete-btn'>Delete</button>";

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

  document.getElementById("fill").onclick = () => {
    const code = document.getElementById("code").textContent;

    // Copy to clipboard
    navigator.clipboard.writeText(code);

    // Also autofill in webpage
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: "fill_otp", code },
        (response) => {
          console.log("Autofill response:", response);
        }
      );
    });
  };

  // Delete button handler
  document.getElementById("delete-btn").addEventListener("click", () => {
    deleteKey(name);
    location.hash = "#list";
  });

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
  const url = URL.createObjectURL(file);

  img.onload = () => {
    decodeQrFromImage(img);
    URL.revokeObjectURL(url);
  };

  img.src = url;
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
