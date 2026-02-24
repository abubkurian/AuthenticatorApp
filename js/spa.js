

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

      // Action Buttons
      const viewBtn = createBtn("View", () => location.hash = `#view/${encodeURIComponent(name)}`);
      const deleteBtn = createBtn("Delete", () => deleteKey(name));


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

      const fillBtn = createBtn("Fill", () => handleFill(code.textContent));

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
      { action: "fill_otp", codeNum: currentCode },
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


// Load add page
function loadAddPage() {
  const container = document.getElementById("page-add");

  fetch("add.html")
    .then(response => response.text())
    .then(html => {
      container.innerHTML = html;

      // Manually load the JS
      const script = document.createElement("script");
      script.src = "js/add-page.js";
      script.defer = true;
      document.body.appendChild(script);
    })
    .catch(err => console.error("Error loading page:", err));
}






// Auto-handle hash changes & initial load
window.addEventListener("hashchange", () => showPage(location.hash));
window.addEventListener("load", () => showPage(location.hash || "#list"));
