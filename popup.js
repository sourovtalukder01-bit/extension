document.addEventListener('DOMContentLoaded', () => {
    const typeSelect = document.getElementById('typeValue');
    const bookingForSelect = document.getElementById('bookingForValue');
    const targetDatesInput = document.getElementById('targetDates');
    const passportNoInput = document.getElementById('passportNo');
    const dobInput = document.getElementById('dob');
    const emailInput = document.getElementById('email');
    const tgTokenInput = document.getElementById('tgToken');
    const tgChatIdInput = document.getElementById('tgChatId');

    const firstNameInput = document.getElementById('firstName');
    const surnameInput = document.getElementById('surname');
    const searchIntervalInput = document.getElementById('searchInterval');

    const proxyHostInput = document.getElementById('proxyHost');
    const proxyPortInput = document.getElementById('proxyPort');
    const proxyUserInput = document.getElementById('proxyUser');
    const proxyPassInput = document.getElementById('proxyPass');
    const useStickyInput = document.getElementById('useStickyProxy');

    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const statusText = document.getElementById('status');

    const logArea = document.getElementById('logArea');
    const clearLogsBtn = document.getElementById('clearLogsBtn');

   
    const DEFAULT_PROXY = {
        host: "proxy.smartproxy.net",
        port: "3120",
        username: "smart-zcoa781ayrze",
        password: "te5uMzBWgKYnAIHT",
        targetDomain: "bd-gr-services.gvcworld.eu",
        useSticky: true
    };

    function renderLogs(logs) {
        if (!logArea) return;
        if (!logs || logs.length === 0) {
            logArea.value = "No logs available yet...";
        } else {
            logArea.value = logs.join('\n');
            logArea.scrollTop = logArea.scrollHeight;
        }
    }

    function updateStatusUI(isRunning) {
        if (isRunning) {
            statusText.innerText = "Status: Bot is RUNNING 🟢";
            statusText.style.color = "green";
        } else {
            statusText.innerText = "Status: Bot is STOPPED 🔴";
            statusText.style.color = "red";
        }
    }

    chrome.storage.local.get(['botData', 'proxyConfig', 'isRunning', 'botLogs'], (result) => {
        if (result.botData) {
            typeSelect.value = result.botData.typeValue || "0";
            bookingForSelect.value = result.botData.bookingForValue || "0";
            targetDatesInput.value = result.botData.targetDates || "";
            passportNoInput.value = result.botData.passportNo || "";
            dobInput.value = result.botData.dob || "";
            emailInput.value = result.botData.email || "";
            tgTokenInput.value = result.botData.tgToken || "";
            tgChatIdInput.value = result.botData.tgChatId || "";

            firstNameInput.value = result.botData.firstName || "";
            surnameInput.value = result.botData.surname || "";
            searchIntervalInput.value = result.botData.searchInterval || "30";
        }

        const savedProxy = result.proxyConfig || {};
        if (proxyHostInput) proxyHostInput.value = savedProxy.host || DEFAULT_PROXY.host;
        if (proxyPortInput) proxyPortInput.value = savedProxy.port || DEFAULT_PROXY.port;
        if (proxyUserInput) proxyUserInput.value = savedProxy.baseUsername || DEFAULT_PROXY.username;
        if (proxyPassInput) proxyPassInput.value = savedProxy.password || DEFAULT_PROXY.password;
        if (useStickyInput) {
            useStickyInput.checked =
                savedProxy.useSticky !== undefined ? Boolean(savedProxy.useSticky) : DEFAULT_PROXY.useSticky;
        }

        renderLogs(result.botLogs);
        updateStatusUI(result.isRunning);
    });

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            if (changes.botLogs) {
                renderLogs(changes.botLogs.newValue);
            }
            if (changes.isRunning) {
                updateStatusUI(changes.isRunning.newValue);
            }
        }
    });

    if (clearLogsBtn) {
        clearLogsBtn.addEventListener('click', () => {
            chrome.storage.local.set({ botLogs: [] }, () => {
                renderLogs([]);
            });
        });
    }

    function reloadActiveTab() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.reload(tabs[0].id);
            }
        });
    }

    startBtn.addEventListener('click', () => {
        if (!targetDatesInput.value.trim() || !passportNoInput.value.trim() || !dobInput.value.trim()) {
            statusText.innerText = "Please fill in all required fields!";
            statusText.style.color = "orange";
            return;
        }

        const botData = {
            typeValue: typeSelect.value,
            bookingForValue: bookingForSelect.value,
            targetDates: targetDatesInput.value.trim(),
            passportNo: passportNoInput.value.trim(),
            dob: dobInput.value.trim(),
            email: emailInput.value.trim(),
            tgToken: tgTokenInput.value.trim(),
            tgChatId: tgChatIdInput.value.trim(),

            firstName: firstNameInput.value.trim(),
            surname: surnameInput.value.trim(),
            searchInterval: searchIntervalInput.value.trim() || "30",
        };

        const proxyHost = (proxyHostInput && proxyHostInput.value.trim()) || DEFAULT_PROXY.host;
        const proxyPort = (proxyPortInput && proxyPortInput.value.trim()) || DEFAULT_PROXY.port;
        const proxyUser = (proxyUserInput && proxyUserInput.value.trim()) || DEFAULT_PROXY.username;
        const proxyPass = (proxyPassInput && proxyPassInput.value.trim()) || DEFAULT_PROXY.password;
        const useSticky = useStickyInput ? useStickyInput.checked : DEFAULT_PROXY.useSticky;

        chrome.storage.local.set({
            botData: botData,
            isRunning: true,
            bookedCount: 0,
            proxyRetryCount: 0
        }, () => {
            chrome.runtime.sendMessage({
                action: "SET_PROXY",
                config: {
                    host: proxyHost,
                    port: proxyPort,
                    username: proxyUser,
                    password: proxyPass,
                    targetDomain: DEFAULT_PROXY.targetDomain,
                    useSticky: useSticky
                }
            }, (res) => {
                if (res && res.success) {
                    statusText.innerText = "Status: Bot & Proxy Started! 🟢";
                    statusText.style.color = "green";
                } else {
                    statusText.innerText = "Status: Bot Started (Proxy Error) 🟠";
                    statusText.style.color = "orange";
                }
                reloadActiveTab();
            });
        });
    });

    stopBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: "CLEAR_PROXY" }, () => {
            chrome.storage.local.set({
                isRunning: false,
                proxyRetryCount: 0
            }, () => {
                statusText.innerText = "Status: Bot & Proxy STOPPED 🔴";
                statusText.style.color = "red";
            });
        });
    });
});