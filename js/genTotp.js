


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