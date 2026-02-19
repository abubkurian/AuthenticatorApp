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

});
