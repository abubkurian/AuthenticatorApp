// Base32 decoding function
function base32toBytes(base32) {
    const base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = "";
    let bytes = [];

    base32 = base32.toUpperCase().replace(/=+$/, '');

    for (let i = 0; i < base32.length; i++) {
        const val = base32chars.indexOf(base32.charAt(i));
        if (val < 0) continue;
        bits += val.toString(2).padStart(5, '0');
    }

    for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.substring(i, i + 8), 2));
    }

    return new Uint8Array(bytes);
}

async function generateTOTP(secret, interval = 30) {
    const key = base32toBytes(secret);
    const counter = Math.floor(Date.now() / 1000 / interval);
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setUint32(4, counter); // set last 4 bytes

    const cryptoKey = await crypto.subtle.importKey(
        'raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
    );

    const hmac = await crypto.subtle.sign('HMAC', cryptoKey, buffer);
    const hmacBytes = new Uint8Array(hmac);
    const offset = hmacBytes[hmacBytes.length - 1] & 0xf;
    const binary = ((hmacBytes[offset] & 0x7f) << 24)
        | (hmacBytes[offset + 1] << 16)
        | (hmacBytes[offset + 2] << 8)
        | (hmacBytes[offset + 3]);

    const otp = binary % 1000000;
    return otp.toString().padStart(6, '0');
}

// UI Elements
const codeEl = document.getElementById('code');
const copyBtn = document.getElementById('copyBtn');
const setupSection = document.getElementById('setup-section');
const mainSection = document.getElementById('main-section');
const inputField = document.getElementById('secret-input');
const saveSecretBtn = document.getElementById('save-secret');
const changeSecretBtn = document.getElementById('change-secret');

let secret = "";

// Show TOTP and refresh every 30s
async function updateCode() {
    if (!secret) return;
    const code = await generateTOTP(secret);
    codeEl.textContent = code;
}
setInterval(updateCode, 30000);

// Load saved secret
chrome.storage.sync.get(["totpSecret"], async (result) => {
    if (result.totpSecret) {
        secret = result.totpSecret;
        setupSection.style.display = "none";
        mainSection.style.display = "block";
        await updateCode();
    } else {
        setupSection.style.display = "block";
        mainSection.style.display = "none";
    }
});

// Save secret
saveSecretBtn.addEventListener("click", () => {
    const newSecret = inputField.value.trim().toUpperCase();
    if (newSecret.length === 0) return;

    chrome.storage.sync.set({ totpSecret: newSecret }, () => {
        secret = newSecret;
        inputField.value = "";
        setupSection.style.display = "none";
        mainSection.style.display = "block";
        updateCode();
    });
});

// Copy code
copyBtn.addEventListener("click", async () => {
    const code = codeEl.textContent;
    try {
        await navigator.clipboard.writeText(code);
        copyBtn.textContent = "Copied!";
        setTimeout(() => (copyBtn.textContent = "Copy Code"), 1500);
    } catch {
        alert("Failed to copy.");
    }
});

// Change secret
changeSecretBtn.addEventListener("click", () => {
    chrome.storage.sync.remove("totpSecret", () => {
        secret = "";
        mainSection.style.display = "none";
        setupSection.style.display = "block";
    });
});
