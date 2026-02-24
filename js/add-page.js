// // This file runs ONLY in add.html

// document.addEventListener("DOMContentLoaded", () => {
//   document.getElementById("qr-upload").addEventListener("change", handleQrUpload);

//   document.getElementById("save-btn").addEventListener("click", saveManualKey);

//   document.getElementById("close-btn").addEventListener("click", () => window.close());
// });

document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("qr-upload");
  const dropArea = document.getElementById("drop-area");
  const previewImage = document.getElementById("preview-image");
  const uploadText = document.getElementById("upload-text");

  fileInput.addEventListener("change", handleQrUpload);
  document.getElementById("save-btn").addEventListener("click", saveManualKey);
  document.getElementById("close-btn").addEventListener("click", () => window.close());

  // Prevent default drag behaviors
  ["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // Highlight drop area
  ["dragenter", "dragover"].forEach(eventName => {
    dropArea.addEventListener(eventName, () => {
      dropArea.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach(eventName => {
    dropArea.addEventListener(eventName, () => {
      dropArea.classList.remove("dragover");
    });
  });

  // Handle drop
  dropArea.addEventListener("drop", (e) => {
    const files = e.dataTransfer.files;
    if (files.length) {
      fileInput.files = files;
      previewFile(files[0]);
      handleQrUpload({ target: fileInput });
    }
  });


  function previewFile(file) {
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      previewImage.src = e.target.result;
      previewImage.hidden = false;
      uploadText.style.display = "none";
    };
    reader.readAsDataURL(file);
  }

  function handleQrUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file) {
      previewFile(file);
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        decodeQrFromImage(img);
        URL.revokeObjectURL(url);
      };

      img.src = url;
    }
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

});
