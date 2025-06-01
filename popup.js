// Base32 decoding
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

// Generate TOTP
async function generateTOTP(secret, interval = 30) {
    const key = base32toBytes(secret);
    const counter = Math.floor(Date.now() / 1000 / interval);
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setUint32(4, counter); // last 4 bytes only

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

// Load and display TOTP
const secret = code.secret; // replace with your base32 secret

async function updateCode() {
    const code = await generateTOTP(secret);
    document.getElementById('code').textContent = code;
}


// Refresh every 30s
updateCode();
setInterval(updateCode, 30000);

// Copy code

document.getElementById('copyBtn').addEventListener('click', async () => {
    const code = document.getElementById('code').textContent;
    try {
        await navigator.clipboard.writeText(code);
        const btn = document.getElementById('copyBtn');
        btn.textContent = "Copied!";
        setTimeout(() => btn.textContent = "Copy Code", 1500);
    } catch (err) {
        alert('Failed to copy code.');
    }
});




