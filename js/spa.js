

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

  // Special handling for "addnew" route on Linux popup - open in new tab instead of popup
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
 **/
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

      const buttons = document.createElement("div");
      buttons.className = "button-row";
      // Action Buttons
      const viewBtn = createBtn("icons/view.svg", () => location.hash = `#view/${encodeURIComponent(name)}`, "View");
      // const deleteBtn = createBtn("icons/delete.svg", () => deleteKey(name), "Delete");


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

      const fillBtn = createBtn("icons/fill.svg", () => handleFill(code.textContent), "Fill");

      // Append elements to div

      buttons.append(viewBtn, fillBtn);
      div.append(label, code, buttons);
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
function createBtn(imgSrc, onClick, altText = "") {
  const btn = document.createElement("button");

  const img = document.createElement("img");
  img.src = imgSrc;
  img.alt = altText;
  img.className = "icon";

  btn.appendChild(img);
  btn.title = altText;
  btn.onclick = onClick;

  return btn;
}

function handleFill(currentCode) {

  // Check if the code is actually loaded
  if (currentCode === "Loading..." || currentCode === "Error") {
    console.warn("Code not ready yet.");
    return;
  }
  // Copy to clipboard safely
  navigator.clipboard.writeText(currentCode)
    .then(() => console.log("Copied to clipboard"))
    .catch(err => console.error("Clipboard error:", err));

  // Send message to active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs.length || !tabs[0].id) {
      console.error("No active tab found.");
      return;
    }

    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: "fill_otp", code: currentCode },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Message error:", chrome.runtime.lastError.message);
        } else {
          console.log("Autofill response:", response);
        }
      }
    );
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
  container.innerHTML =
    "<div class='account-item'>" +
    "<h3>" + name + "</h3>" +
    "<div id='code'>Loading...</div>" +
    "<div id='qr-preview' class='upload-box'></div>" +
    "<div class='button-row'>" +
    "<button id='copy'><img src='icons/copy.svg' alt='Copy' class='icon' title='Copy'></button><br>" +
    "<button id='fill'><img src='icons/fill.svg' alt='Fill' class='icon' title='Fill'></button><br>" +
    "<button id='delete-btn'><img src='icons/delete.svg' alt='Delete' class='icon' title='Delete'></button><br>" +
    "</div>" +
    "<button id='back-btn'>Back</button><br>" +
    "</div>";

  chrome.storage.sync.get({ keys: {} }, (data) => {
    const secret = data.keys[name];

    // --- QR Code Preview ---
    if (secret && typeof QRCode !== "undefined") {
      const uri = "otpauth://totp/" + encodeURIComponent(name) +
        "?secret=" + secret + "&issuer=" + encodeURIComponent(name);
      new QRCode(document.getElementById("qr-preview"), {
        text: uri,
        width: 160,
        height: 160,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    }

    const updateCode = () => {
      generateTOTP(secret).then(code => {
        document.getElementById("code").textContent = code;
      });
    };
    const interval = setInterval(updateCode, 30000); // Update every 30s
    updateCode(); // Run once immediately

    // Clear the interval when navigating away to avoid leaking timers
    window.addEventListener("hashchange", () => clearInterval(interval), { once: true });
  });

  document.getElementById("copy").onclick = () => {
    const code = document.getElementById("code").textContent;
    navigator.clipboard.writeText(code);
  };

  document.getElementById("fill").onclick = () => {
    const code = document.getElementById("code").textContent;

    // Guard against code not being ready yet
    if (code === "Loading..." || code === "Error") {
      console.warn("Code not ready yet.");
      return;
    }

    // Copy to clipboard
    navigator.clipboard.writeText(code);

    // Also autofill in webpage
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs.length || !tabs[0].id) {
        console.error("No active tab found.");
        return;
      }
      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: "fill_otp", code },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("Message error:", chrome.runtime.lastError.message);
          } else {
            console.log("Autofill response:", response);
          }
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


// Reset the add page form each time it is shown
function loadAddPage() {
  document.getElementById("key-name").value = "";
  document.getElementById("key-secret").value = "";
  document.getElementById("qr-status").textContent = "";
  document.getElementById("preview-image").hidden = true;
  document.getElementById("upload-text").style.display = "";
}






// Auto-handle hash changes & initial load
window.addEventListener("hashchange", () => showPage(location.hash));
window.addEventListener("load", () => showPage(location.hash || "#list"));
