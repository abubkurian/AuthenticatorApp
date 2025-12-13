// This file runs ONLY in add.html

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("qr-upload").addEventListener("change", handleQrUpload);

  document.getElementById("save-btn").addEventListener("click", saveManualKey);

  document.getElementById("close-btn").addEventListener("click", () => window.close());
});
