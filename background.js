const NOPECHA_ID = "dknlfmjaanfblgfdfebhijalfmhmjjjo"; 


function applyProxyConfig({ host, port, targetDomain }) {
    return new Promise((resolve) => {
        const cleanHost = String(host || "").trim();
        const cleanPort = parseInt(port, 10);
        const cleanDomain = String(targetDomain || "").trim();

        if (!cleanHost || Number.isNaN(cleanPort)) {
            resolve({ success: false, error: "Invalid proxy host or port" });
            return;
        }

        let config;

        if (cleanDomain) {
            const pacScript = `
                function FindProxyForURL(url, host) {
                    if (dnsDomainIs(host, "${cleanDomain}") || shExpMatch(host, "*.${cleanDomain}")) {
                        return "PROXY ${cleanHost}:${cleanPort}";
                    }
                    return "DIRECT";
                }
            `;
            config = {
                mode: "pac_script",
                pacScript: { data: pacScript }
            };
        } else {
            config = {
                mode: "fixed_servers",
                rules: {
                    singleProxy: {
                        scheme: "http",
                        host: cleanHost,
                        port: cleanPort
                    },
                    bypassList: ["localhost", "127.0.0.1"]
                }
            };
        }

        chrome.proxy.settings.set({ value: config, scope: "regular" }, () => {
            if (chrome.runtime.lastError) {
                console.error("Proxy set failed:", chrome.runtime.lastError.message);
                resolve({ success: false, error: chrome.runtime.lastError.message });
                return;
            }
            console.log(`Proxy enabled: ${cleanHost}:${cleanPort}`);
            resolve({ success: true });
        });
    });
}


function clearProxyConfig() {
    return new Promise((resolve) => {
        chrome.proxy.settings.clear({ scope: "regular" }, () => {
            if (chrome.runtime.lastError) {
                console.error("Proxy clear failed:", chrome.runtime.lastError.message);
                resolve({ success: false, error: chrome.runtime.lastError.message });
                return;
            }
            console.log("Proxy cleared.");
            resolve({ success: true });
        });
    });
}

function buildStickyUsername(baseUser, sessionId) {
    if (!baseUser) return "";
    return `${baseUser}-session-${sessionId}`;
}


const authRetries = new Map();

chrome.webRequest.onAuthRequired.addListener(
    (details, callback) => {
        if (!details.isProxy) {
            callback({});
            return;
        }

        const attempts = authRetries.get(details.requestId) || 0;
        if (attempts >= 2) {
           
            authRetries.delete(details.requestId);
            callback({ cancel: true });
            return;
        }
        authRetries.set(details.requestId, attempts + 1);

        chrome.storage.local.get(["proxyConfig"], (res) => {
            const cfg = res.proxyConfig;
            if (cfg && cfg.enabled && cfg.username && cfg.password) {
                callback({
                    authCredentials: {
                        username: cfg.username,
                        password: cfg.password
                    }
                });
            } else {
                callback({});
            }
        });
    },
    { urls: ["<all_urls>"] },
    ["asyncBlocking"]
);

chrome.webRequest.onCompleted.addListener(
    (details) => { authRetries.delete(details.requestId); },
    { urls: ["<all_urls>"] }
);

chrome.webRequest.onErrorOccurred.addListener(
    (details) => { authRetries.delete(details.requestId); },
    { urls: ["<all_urls>"] }
);


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "TOGGLE_NOPECHA") {
        chrome.management.setEnabled(NOPECHA_ID, Boolean(message.state), () => {
            if (chrome.runtime.lastError) {
                console.error("NopeCha toggle error:", chrome.runtime.lastError.message);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
                return;
            }
            console.log("NopeCha state changed to: " + message.state);
            sendResponse({ success: true });
        });
        return true;
    }

    if (message.action === "SEND_TELEGRAM") {
        if (!message.token || !message.chatId) {
            sendResponse({ success: false, error: "Missing Telegram token or chatId" });
            return false;
        }

        const url = `https://api.telegram.org/bot${message.token}/sendMessage`;
        fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: message.chatId,
                text: message.text
            })
        })
        .then(async (res) => {
            const data = await res.json();
            if (!res.ok || !data.ok) {
                sendResponse({ success: false, error: data.description || `HTTP ${res.status}` });
            } else {
                sendResponse({ success: true, data });
            }
        })
        .catch((err) => sendResponse({ success: false, error: err.message }));
        return true;
    }

    if (message.action === "SET_PROXY") {
        const cfg = message.config || {};
        const sessionId = Math.floor(100000 + Math.random() * 900000);
        const proxyConfig = {
            host: cfg.host,
            port: cfg.port,
            baseUsername: cfg.username || "",
            username: cfg.useSticky
                ? buildStickyUsername(cfg.username, sessionId)
                : (cfg.username || ""),
            password: cfg.password || "",
            targetDomain: cfg.targetDomain || "bd-gr-services.gvcworld.eu",
            useSticky: Boolean(cfg.useSticky),
            enabled: true
        };

        chrome.storage.local.set({ proxyConfig }, async () => {
            const result = await applyProxyConfig(proxyConfig);
            sendResponse({ ...result, sessionId });
        });
        return true;
    }

    if (message.action === "ROTATE_PROXY_IP") {
        chrome.storage.local.get(["proxyConfig"], async (res) => {
            const cfg = res.proxyConfig;
            if (!cfg || !cfg.enabled || !cfg.host) {
                sendResponse({ success: false, error: "Proxy is not configured or enabled" });
                return;
            }

            const newSessionId = Math.floor(100000 + Math.random() * 900000);
            const updatedConfig = {
                ...cfg,
                username: cfg.useSticky
                    ? buildStickyUsername(cfg.baseUsername, newSessionId)
                    : cfg.baseUsername
            };

           
            await clearProxyConfig();
            await new Promise((r) => setTimeout(r, 1000));

            chrome.storage.local.set({ proxyConfig: updatedConfig }, async () => {
                const result = await applyProxyConfig(updatedConfig);
                sendResponse({ ...result, sessionId: newSessionId });
            });
        });
        return true;
    }

    if (message.action === "CLEAR_PROXY") {
        chrome.storage.local.set({ proxyConfig: { enabled: false } }, async () => {
            const result = await clearProxyConfig();
            sendResponse(result);
        });
        return true;
    }
});