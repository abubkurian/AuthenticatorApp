chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "fill_otp") {
        const otp = msg.code;

        // Try common OTP input names
        const selectors = [
            "input[name='otp']",
            "input[name='totp']",
            "input[name='code']",
            "input[name='verification_code']",
            "input[type='number']",
            "input[type='text']"
        ];

        let filled = false;

        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
                el.value = otp;
                el.dispatchEvent(new Event("input", { bubbles: true }));
                filled = true;
                break;
            }
        }

        sendResponse({ success: filled });
    }
});
