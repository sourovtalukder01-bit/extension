const delay = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

const randomDelay = (min, max) => {
    let ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, ms));
};

const getStorageData = (keys) => {
    return new Promise((resolve) => {
        chrome.storage.local.get(keys, (res) => resolve(res));
    });
};

function humanClick(element) {
    if (!element) return;
    const events = ['mouseenter', 'mouseover', 'mousedown', 'mouseup', 'click'];
    events.forEach(eventType => {
        const event = new MouseEvent(eventType, {
            bubbles: true,
            cancelable: true,
            view: window,
            buttons: 1
        });
        element.dispatchEvent(event);
    });
}

async function addLog(message) {
    const now = new Date();
    const timeString = now.toLocaleTimeString(); // যেমন: 10:30:15 AM
    const logEntry = `[${timeString}] ${message}`;
    
    let res = await getStorageData(['botLogs']);
    let logs = res.botLogs || [];
    logs.push(logEntry);
 
    if (logs.length > 50) {
        logs.shift(); 
    }
    chrome.storage.local.set({ botLogs: logs });
}

async function runBot() {
    let res = await getStorageData(['botData', 'isRunning', 'bookedCount']);

    if (!res.isRunning) return;

    const data = res.botData;

    if (!data) {
        return;
    }

    let bookedCount = res.bookedCount || 0;

    if (bookedCount >= 5) {
        await addLog("Bot Stopped: Max limit (5) reached.");
        sendTelegramMessage(data.tgToken, data.tgChatId, "Bot Stopped: Max limit (5) reached.");
        chrome.storage.local.set({ isRunning: false });
        return;
    }

    fillStaticInputs(data);
    await addLog("Filled static inputs (Name, Passport, DOB).");
    await delay(1500);

    const dateArray = data.targetDates.split(',').map(d => d.trim());
    await addLog("Starting search for dates: " + dateArray.join(', '));

    while (true) {
        let currentStatus = await getStorageData(['isRunning']);
        if (!currentStatus.isRunning) {
            await addLog("Bot was stopped manually.");
            break;
        }

        if (document.body.innerText.includes("Please login") || document.querySelector('input[type="password"]')) {
            await addLog("Session expired. Please login again.");
            sendTelegramMessage(data.tgToken, data.tgChatId, "Bot Stopped: Session expired, please login.");
            chrome.storage.local.set({ isRunning: false });
            break;
        }

        if (document.body.innerText.includes("Too many requests") || document.body.innerText.includes("Access Denied")) {
            await addLog("Rate limited! Waiting 60 seconds...");
            sendTelegramMessage(data.tgToken, data.tgChatId, "Warning: Rate limited. Waiting 60 seconds...");
            await delay(60000);
            continue;
        }

        let slotBookedInThisCycle = false;

        for (let i = 0; i < dateArray.length; i++) {
            let currentDate = dateArray[i];
            await addLog(`Searching availability for: ${currentDate}`);

            const dateInput = document.querySelector("#datefrom");

            if (dateInput) {
                dateInput.focus(); 
                await randomDelay(200, 400); 
                
                dateInput.value = currentDate;
                
                dateInput.dispatchEvent(new Event("input", { bubbles: true }));
                dateInput.dispatchEvent(new Event("change", { bubbles: true }));
                dateInput.blur(); 
            }

            const searchBtn = document.querySelector("#btn-search");
            await randomDelay(400, 800); 

            if (searchBtn) {
                humanClick(searchBtn); 
            }

            await randomDelay(6500, 8000); 

            const allSlots = document.querySelectorAll("#resultDiv table#result tbody tr td div[id]");

            if (allSlots.length > 0) {
                await addLog(`Slot found for ${currentDate}! Booking in progress...`);
                let targetIndex = Math.min(bookedCount, allSlots.length - 1);
                const slotAvailable = allSlots[targetIndex];
                
                humanClick(slotAvailable); 
                await randomDelay(1200, 1600);

                const checkbox = document.querySelector('#submissiontext #submitinfo');
                if (checkbox) humanClick(checkbox); 

                await randomDelay(800, 1200);

                const captchaFrame = document.querySelector('iframe[src*="recaptcha"]');
                if (captchaFrame) {
                    await toggleNopecha(true);
                    await delay(12000);
                    await toggleNopecha(false);
                }

                const bookBtn = document.querySelector('#button-new-appointment');
                if (bookBtn) humanClick(bookBtn);

                bookedCount += 1;
                chrome.storage.local.set({ bookedCount: bookedCount });

                await addLog(`SUCCESS: Booked slot ${bookedCount} for ${currentDate}`);
                sendTelegramMessage(
                    data.tgToken,
                    data.tgChatId,
                    `SUCCESS: Booked slot ${targetIndex + 1} for ${currentDate}. Passport: ${data.passportNo}`
                );

                slotBookedInThisCycle = true;

                if (bookedCount >= 5) {
                    await addLog("All 5 slots booked. Stopping bot.");
                    chrome.storage.local.set({ isRunning: false });
                    sendTelegramMessage(data.tgToken, data.tgChatId, "Bot Stopped: 5 slots booked successfully.");
                }

                break; 
            } else {
                await addLog(`No slots for ${currentDate}.`);
                await randomDelay(1800, 2500);
            }
        }

        if (slotBookedInThisCycle) {
            break;
        }

        let intervalMs = (parseInt(data.searchInterval) || 30) * 1000;
        await addLog(`Waiting ${data.searchInterval || 30} seconds before next search cycle...`);
        await delay(intervalMs); 
    }
}

function fillStaticInputs(data) {
    const typeSelect = document.querySelector("#type");
    if (typeSelect && data.typeValue !== undefined) {
        typeSelect.value = data.typeValue;
        typeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }

    const bookingForSelect = document.querySelector("#bookingfor");
    if (bookingForSelect && data.bookingForValue !== undefined) {
        bookingForSelect.value = data.bookingForValue;
        bookingForSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }

    const dobInput = document.querySelector("#gp_dateofbirth");
    if (dobInput) {
        dobInput.value = data.dob;
        dobInput.dispatchEvent(new Event("input", { bubbles: true }));
        dobInput.dispatchEvent(new Event("change", { bubbles: true }));
    }

    const passportInput = document.querySelector("#gp_passportnumber");
    if (passportInput) {
        passportInput.value = data.passportNo;
        passportInput.dispatchEvent(new Event("input", { bubbles: true }));
        passportInput.dispatchEvent(new Event("change", { bubbles: true }));
    }

    const firstNameInput = document.querySelector("#gp_firstname");
    if (firstNameInput && data.firstName) {
        firstNameInput.value = data.firstName;
        firstNameInput.dispatchEvent(new Event("input", { bubbles: true }));
        firstNameInput.dispatchEvent(new Event("change", { bubbles: true }));
    }

    const surnameInput = document.querySelector("#gp_surname");
    if (surnameInput && data.surname) {
        surnameInput.value = data.surname;
        surnameInput.dispatchEvent(new Event("input", { bubbles: true }));
        surnameInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
}

function toggleNopecha(state) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: "TOGGLE_NOPECHA", state: state }, (res) => {
            resolve(res);
        });
    });
}

function sendTelegramMessage(token, chatId, text) {
    chrome.runtime.sendMessage({
        action: "SEND_TELEGRAM",
        token: token,
        chatId: chatId, 
        text: text,
    });
}

if (!navigator.onLine) {
    setTimeout(() => { window.location.reload(); }, 10000);
} else {
    window.addEventListener('load', async () => {
        await randomDelay(1500, 2500);
        runBot();
    });
}