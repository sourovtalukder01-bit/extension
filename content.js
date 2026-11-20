const MAX_SLOTS = 5;
const MAX_DOM_ERRORS = 3;
const MIN_RELOAD_MINUTES = 14;
const MAX_RELOAD_MINUTES = 18;
const MAX_PROXY_RETRIES = 3;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const randomDelay = (min, max) => {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return delay(ms);
};

const getStorageData = (keys) => {
    return new Promise((resolve) => {
        chrome.storage.local.get(keys, (res) => resolve(res || {}));
    });
};

const setStorageData = (obj) => {
    return new Promise((resolve) => {
        chrome.storage.local.set(obj, resolve);
    });
};

let isRunningLocal = false;

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.isRunning) {
        isRunningLocal = Boolean(changes.isRunning.newValue);
    }
});

async function smartDelay(ms) {
    const step = 250;
    let elapsed = 0;

    while (elapsed < ms) {
        if (!isRunningLocal) return false;
        const waitTime = Math.min(step, ms - elapsed);
        await delay(waitTime);
        elapsed += waitTime;
    }
    return isRunningLocal;
}

async function humanClick(element) {
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const clientX = rect.left + rect.width * (0.3 + Math.random() * 0.4);
    const clientY = rect.top + rect.height * (0.3 + Math.random() * 0.4);

    const commonOpts = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX,
        clientY
    };

    element.dispatchEvent(new MouseEvent('mouseenter', { ...commonOpts, buttons: 0 }));
    element.dispatchEvent(new MouseEvent('mouseover', { ...commonOpts, buttons: 0 }));
    await randomDelay(30, 80);

    element.dispatchEvent(new MouseEvent('mousedown', { ...commonOpts, button: 0, buttons: 1 }));
    await randomDelay(55, 130);

    element.dispatchEvent(new MouseEvent('mouseup', { ...commonOpts, button: 0, buttons: 0 }));
    element.dispatchEvent(new MouseEvent('click', { ...commonOpts, button: 0, buttons: 0 }));
}

let logQueue = Promise.resolve();

function addLog(message) {
    logQueue = logQueue
        .then(async () => {
            const now = new Date();
            const timeString = now.toLocaleTimeString();
            const logEntry = `[${timeString}] ${message}`;

            const res = await getStorageData(['botLogs']);
            const logs = res.botLogs || [];
            logs.push(logEntry);

            if (logs.length > 50) {
                logs.shift();
            }
            await setStorageData({ botLogs: logs });
        })
        .catch((err) => console.error("Log write error:", err));

    return logQueue;
}

async function waitForCaptchaSolve(maxWaitMs = 25000) {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
        if (!isRunningLocal) return { solved: false, stopped: true };

        const responseFields = document.querySelectorAll('textarea[name="g-recaptcha-response"]');
        for (const field of responseFields) {
            if (field.value && field.value.trim().length > 0) {
                return { solved: true, stopped: false };
            }
        }
        await delay(500);
    }
    return { solved: false, stopped: false };
}

function fillStaticInputs(data, onlyIfEmpty = false) {
    const missingFields = [];

    const setField = (selector, value, label, isSelect = false) => {
        if (value === undefined || value === "") return;

        const el = document.querySelector(selector);
        if (!el) {
            missingFields.push(label);
            return;
        }

        if (onlyIfEmpty && el.value === String(value)) return;

        el.focus();
        el.value = value;
        if (!isSelect) {
            el.dispatchEvent(new Event("input", { bubbles: true }));
        }
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.blur();
    };

    setField("#type", data.typeValue, "Type", true);
    setField("#bookingfor", data.bookingForValue, "Booking For", true);
    setField("#gp_dateofbirth", data.dob, "DOB");
    setField("#gp_passportnumber", data.passportNo, "Passport No");
    setField("#gp_firstname", data.firstName, "First Name");
    setField("#gp_surname", data.surname, "Surname");

    return missingFields;
}

function getAvailableSlots() {
    const rawSlots = Array.from(
        document.querySelectorAll("#resultDiv table#result tbody tr td div[id]")
    );

    return rawSlots.filter((el) => {
        const isVisible = el.offsetParent !== null;
        const isDisabled =
            el.disabled ||
            el.classList.contains('disabled') ||
            el.getAttribute('aria-disabled') === 'true';
        return isVisible && !isDisabled;
    });
}

function hasBookingConfirmationText(previousResultText = "") {
    const confirmKeywords = [
        "successfully",
        "confirmed",
        "booking reference",
        "appointment has been booked"
    ];

    const containers = document.querySelectorAll(
        "#resultDiv, .alert-success, .alert, .modal, .swal2-popup, #message, .notification"
    );

    let scopedText = "";
    containers.forEach((el) => {
        if (el.offsetParent !== null) {
            scopedText += " " + (el.innerText || "");
        }
    });

    const normalizedScoped = scopedText.toLowerCase().trim();
    const normalizedPrev = previousResultText.toLowerCase().trim();

    if (normalizedScoped && normalizedScoped !== normalizedPrev) {
        return confirmKeywords.some((kw) => normalizedScoped.includes(kw));
    }

    const currentUrl = window.location.href.toLowerCase();
    if (currentUrl.includes("confirm") || currentUrl.includes("success")) {
        const bodyText = (document.body.innerText || "").toLowerCase();
        return confirmKeywords.some((kw) => bodyText.includes(kw));
    }

    return false;
}

function toggleNopecha(state) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: "TOGGLE_NOPECHA", state }, (res) => {
            if (chrome.runtime.lastError) {
                console.warn("NopeCHA message error:", chrome.runtime.lastError.message);
                resolve({ success: false, error: chrome.runtime.lastError.message });
                return;
            }
            resolve(res || { success: false });
        });
    });
}


function rotateProxyIp() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: "ROTATE_PROXY_IP" }, (res) => {
            if (chrome.runtime.lastError) {
                console.warn("Proxy rotate error:", chrome.runtime.lastError.message);
                resolve({ success: false, error: chrome.runtime.lastError.message });
                return;
            }
            resolve(res || { success: false });
        });
    });
}

function sendTelegramMessage(token, chatId, text) {
    if (!token || !chatId) return Promise.resolve({ skipped: true });

    return new Promise((resolve) => {
        chrome.runtime.sendMessage(
            {
                action: "SEND_TELEGRAM",
                token,
                chatId,
                text
            },
            (res) => {
                if (chrome.runtime.lastError) {
                    console.warn("Telegram message error:", chrome.runtime.lastError.message);
                    resolve({ success: false, error: chrome.runtime.lastError.message });
                    return;
                }
                resolve(res || { success: false });
            }
        );
    });
}

async function handleConfirmedBooking(data, bookedCount, dateStr) {
    const updatedCount = bookedCount + 1;
    await setStorageData({ bookedCount: updatedCount, pendingBooking: null });

    await addLog(`SUCCESS: Booked slot ${updatedCount}/${MAX_SLOTS} for ${dateStr}`);
    const tgRes = await sendTelegramMessage(
        data.tgToken,
        data.tgChatId,
        `SUCCESS: Booked slot ${updatedCount}/${MAX_SLOTS} for ${dateStr}. Passport: ${data.passportNo}`
    );
    if (tgRes && tgRes.success === false) {
        await addLog("Warning: Failed to send Telegram alert.");
    }

    if (updatedCount >= MAX_SLOTS) {
        await addLog(`All ${MAX_SLOTS} slots booked. Stopping bot.`);
        isRunningLocal = false;
        await setStorageData({ isRunning: false });
        await sendTelegramMessage(data.tgToken, data.tgChatId, `Bot Stopped: ${MAX_SLOTS} slots booked successfully.`);
    }

    return updatedCount;
}

let isBotActive = false;

async function runBot() {
    if (isBotActive) return;
    isBotActive = true;

    try {
        const res = await getStorageData(['botData', 'isRunning', 'bookedCount', 'pendingBooking']);
        isRunningLocal = Boolean(res.isRunning);
        if (!isRunningLocal) return;

        const data = res.botData;
        if (!data || !data.targetDates) {
            await addLog("Bot Stopped: Missing botData or targetDates.");
            isRunningLocal = false;
            await setStorageData({ isRunning: false });
            return;
        }

        let bookedCount = res.bookedCount || 0;

        if (res.pendingBooking) {
            const isRecent = Date.now() - res.pendingBooking.timestamp < 30000;
            await setStorageData({ pendingBooking: null });

            if (isRecent && hasBookingConfirmationText("")) {
                bookedCount = await handleConfirmedBooking(data, bookedCount, res.pendingBooking.date);
                if (bookedCount >= MAX_SLOTS) return;
            }
        }

        if (bookedCount >= MAX_SLOTS) {
            await addLog(`Bot Stopped: Max limit (${MAX_SLOTS}) reached.`);
            await sendTelegramMessage(data.tgToken, data.tgChatId, `Bot Stopped: Max limit (${MAX_SLOTS}) reached.`);
            isRunningLocal = false;
            await setStorageData({ isRunning: false });
            return;
        }

        const missing = fillStaticInputs(data);
        if (missing.length > 0) {
            await addLog(`Warning: Some inputs not found on page (${missing.join(', ')}).`);
        } else {
            await addLog("Filled static inputs (Name, Passport, DOB).");
        }

        if (!(await smartDelay(1500))) {
            await addLog("Bot was stopped manually.");
            return;
        }

        const dateArray = data.targetDates
            .split(',')
            .map((d) => d.trim())
            .filter(Boolean);

        if (dateArray.length === 0) {
            await addLog("Bot Stopped: No valid dates provided.");
            isRunningLocal = false;
            await setStorageData({ isRunning: false });
            return;
        }

        await addLog("Starting search for dates: " + dateArray.join(', '));

      
        const pageLoadTime = Date.now();
        const minSec = MIN_RELOAD_MINUTES * 60;
        const maxSec = MAX_RELOAD_MINUTES * 60;
        const reloadAfterMs =
            (Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec) * 1000;

        const reloadMins = Math.floor(reloadAfterMs / 60000);
        const reloadSecs = Math.floor((reloadAfterMs % 60000) / 1000);
        await addLog(`Auto IP rotate & reload scheduled in ${reloadMins}m ${reloadSecs}s.`);

        let consecutiveDomErrors = 0;

        while (isRunningLocal) {
          
            if (Date.now() - pageLoadTime >= reloadAfterMs) {
                await addLog("Refresh time reached. Rotating IP before reload...");
                const rot = await rotateProxyIp();
                if (rot.success) {
                    await addLog(`IP rotated (Session: ${rot.sessionId}). Reloading page...`);
                } else {
                    await addLog("Proxy not active/failed to rotate. Reloading page...");
                }
                await delay(1500);
                window.location.reload();
                return;
            }

            if (!navigator.onLine) {
                await addLog("Offline detected. Waiting 10 seconds to reconnect...");
                const onlineWait = await smartDelay(10000);
                if (!onlineWait) {
                    await addLog("Bot was stopped manually while offline.");
                    break;
                }
                if (!navigator.onLine) {
                    await addLog("Still offline. Reloading page...");
                    window.location.reload();
                    return;
                }
                continue;
            }

            const bodyText = (document.body.innerText || "").toLowerCase();

            if (
                bodyText.includes("please login") ||
                bodyText.includes("session expired") ||
                document.querySelector('input[type="password"]')
            ) {
                await addLog("Session expired. Please login again.");
                await sendTelegramMessage(data.tgToken, data.tgChatId, "Bot Stopped: Session expired, please login.");
                isRunningLocal = false;
                await setStorageData({ isRunning: false });
                break;
            }

           
            if (
                bodyText.includes("too many requests") ||
                bodyText.includes("access denied") ||
                bodyText.includes("unauthorized access")
            ) {
                const retryRes = await getStorageData(['proxyRetryCount']);
                const retries = (retryRes.proxyRetryCount || 0) + 1;

                if (retries > MAX_PROXY_RETRIES) {
                    await setStorageData({ proxyRetryCount: 0, isRunning: false });
                    isRunningLocal = false;
                    await addLog(`Bot Stopped: Blocked even after ${MAX_PROXY_RETRIES} IP rotations.`);
                    await sendTelegramMessage(
                        data.tgToken,
                        data.tgChatId,
                        `Bot Stopped: ${MAX_PROXY_RETRIES} বার IP রোটেট করার পরও Unauthorized Access / Block আসছে।`
                    );
                    break;
                }

                await setStorageData({ proxyRetryCount: retries });
                await addLog(`Access blocked! Rotating IP (Attempt ${retries}/${MAX_PROXY_RETRIES})...`);
                const rot = await rotateProxyIp();

                if (rot.success) {
                    await addLog(`New IP set (Session: ${rot.sessionId}). Reloading page...`);
                    await delay(2000);
                    window.location.reload();
                    return;
                } else {
                    await addLog("Proxy not configured. Waiting 60 seconds...");
                    await sendTelegramMessage(data.tgToken, data.tgChatId, "Warning: Rate limited / Unauthorized Access. Waiting 60 seconds...");
                    const shouldContinue = await smartDelay(60000);
                    if (!shouldContinue) {
                        await addLog("Bot was stopped manually during cooldown.");
                        break;
                    }
                    continue;
                }
            }

            fillStaticInputs(data, true);

            let slotBookedInThisCycle = false;

            for (let i = 0; i < dateArray.length; i++) {
                if (!isRunningLocal) {
                    await addLog("Bot was stopped manually.");
                    return;
                }

                if (!navigator.onLine) {
                    await addLog("Connection dropped mid-cycle. Pausing search...");
                    break;
                }

                const currentDate = dateArray[i];
                await addLog(`Searching availability for: ${currentDate}`);

                const dateInput = document.querySelector("#datefrom");
                const searchBtn = document.querySelector("#btn-search");

                if (!dateInput || !searchBtn) {
                    consecutiveDomErrors += 1;
                    const missingEl = !dateInput ? "#datefrom" : "#btn-search";
                    await addLog(`Error (${consecutiveDomErrors}/${MAX_DOM_ERRORS}): ${missingEl} not found.`);

                    if (consecutiveDomErrors >= MAX_DOM_ERRORS) {
                        await addLog("Bot Stopped: Target page elements missing repeatedly.");
                        await sendTelegramMessage(
                            data.tgToken,
                            data.tgChatId,
                            `Bot Stopped: Element ${missingEl} missing ${MAX_DOM_ERRORS} times in a row. Check browser tab.`
                        );
                        isRunningLocal = false;
                        await setStorageData({ isRunning: false });
                        return;
                    }
                    break;
                }

                consecutiveDomErrors = 0;
                await setStorageData({ proxyRetryCount: 0 });

                dateInput.focus();
                await randomDelay(200, 400);
                dateInput.value = currentDate;
                dateInput.dispatchEvent(new Event("input", { bubbles: true }));
                dateInput.dispatchEvent(new Event("change", { bubbles: true }));
                dateInput.blur();

                await randomDelay(400, 800);
                await humanClick(searchBtn);

                const waitSearch = await smartDelay(Math.floor(Math.random() * 1500) + 6500);
                if (!waitSearch) {
                    await addLog("Bot was stopped manually.");
                    return;
                }

                const availableSlots = getAvailableSlots();

                if (availableSlots.length > 0) {
                    await addLog(`Found ${availableSlots.length} active slot(s) for ${currentDate}! Booking...`);

                    const slotAvailable = availableSlots[0];
                    await humanClick(slotAvailable);
                    await randomDelay(1200, 1600);

                    const checkbox = document.querySelector('#submissiontext #submitinfo');
                    if (checkbox && !checkbox.checked) {
                        await humanClick(checkbox);
                    }

                    await randomDelay(800, 1200);

                    const captchaFrame = document.querySelector('iframe[src*="recaptcha"]');
                    if (captchaFrame) {
                        await addLog("reCAPTCHA detected! Enabling NopeCHA...");
                        let captchaResult = { solved: false, stopped: false };

                        try {
                            await toggleNopecha(true);
                            captchaResult = await waitForCaptchaSolve(25000);
                        } finally {
                            await toggleNopecha(false);
                        }

                        if (captchaResult.stopped) {
                            await addLog("Bot stopped during captcha wait.");
                            return;
                        }

                        if (!captchaResult.solved) {
                            await addLog(`Captcha timeout for ${currentDate}. Skipping to retry...`);
                            continue;
                        }

                        await addLog("Captcha solved!");
                        await randomDelay(400, 800);
                    }

                    const bookBtn = document.querySelector('#button-new-appointment');
                    if (!bookBtn) {
                        await addLog("Error: Book button (#button-new-appointment) not found.");
                        continue;
                    }

                    const resultDivBefore = document.querySelector("#resultDiv")?.innerText || "";

                    await setStorageData({
                        pendingBooking: { date: currentDate, timestamp: Date.now() }
                    });

                    await humanClick(bookBtn);

                    const waitConfirm = await smartDelay(Math.floor(Math.random() * 1500) + 3000);
                    if (!waitConfirm) {
                        await setStorageData({ pendingBooking: null });
                        await addLog("Bot was stopped manually.");
                        return;
                    }

                    if (hasBookingConfirmationText(resultDivBefore)) {
                        bookedCount = await handleConfirmedBooking(data, bookedCount, currentDate);
                        slotBookedInThisCycle = true;

                        if (bookedCount >= MAX_SLOTS) return;
                        break;
                    } else {
                        await setStorageData({ pendingBooking: null });
                        await addLog(`Booking not confirmed for ${currentDate}. Retrying...`);
                    }
                } else {
                    await addLog(`No active slots for ${currentDate}.`);
                    const waitNext = await smartDelay(Math.floor(Math.random() * 700) + 1800);
                    if (!waitNext) {
                        await addLog("Bot was stopped manually.");
                        return;
                    }
                }
            }

            if (!isRunningLocal) break;

            if (slotBookedInThisCycle) {
                await addLog("Preparing next search for remaining slots...");
                if (!(await smartDelay(3000))) {
                    await addLog("Bot was stopped manually.");
                    break;
                }
                continue;
            }

            const intervalMs = (parseInt(data.searchInterval, 10) || 30) * 1000;
            const remainingBeforeReload = reloadAfterMs - (Date.now() - pageLoadTime);

            if (remainingBeforeReload <= 1000) {
                await addLog("Refresh time reached. Rotating IP before reload...");
                const rot = await rotateProxyIp();
                if (rot.success) {
                    await addLog(`IP rotated (Session: ${rot.sessionId}). Reloading page...`);
                }
                await delay(1500);
                window.location.reload();
                return;
            }

            const waitMs = Math.min(intervalMs, remainingBeforeReload);
            await addLog(`Waiting ${Math.ceil(waitMs / 1000)} seconds before next search cycle...`);
            if (!(await smartDelay(waitMs))) {
                await addLog("Bot was stopped manually.");
                break;
            }
        }
    } catch (err) {
        console.error("Bot fatal error:", err);
        await addLog(`Error: ${err.message || "Unexpected error occurred."}`);
    } finally {
        isBotActive = false;
    }
}

window.addEventListener('offline', () => {
    if (isRunningLocal) {
        addLog("Internet connection lost! Waiting to reconnect...");
    }
});

window.addEventListener('online', () => {
    if (isRunningLocal) {
        addLog("Internet connection restored.");
    }
});

async function initBot() {
    const res = await getStorageData(['isRunning']);
    isRunningLocal = Boolean(res.isRunning);
    if (!isRunningLocal) return;

    if (!navigator.onLine) {
        setTimeout(async () => {
            const latest = await getStorageData(['isRunning']);
            if (!latest.isRunning) return;
            await addLog("Offline at startup. Reloading page...");
            window.location.reload();
        }, 10000);
        return;
    }

    const start = async () => {
        await randomDelay(1500, 2500);
        runBot();
    };

    if (document.readyState === 'complete') {
        start();
    } else {
        window.addEventListener('load', start, { once: true });
    }
}

initBot();