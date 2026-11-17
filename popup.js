document.addEventListener('DOMContentLoaded', () => {
    
    chrome.storage.local.get(['botData', 'isRunning'], (res) => {
        if (res.botData) {
            document.getElementById('targetDates').value = res.botData.targetDates;
            document.getElementById('passportNo').value = res.botData.passportNo;
            document.getElementById('dob').value = res.botData.dob;
            document.getElementById('email').value = res.botData.email;
            document.getElementById('tgToken').value = res.botData.tgToken;
            document.getElementById('tgChatId').value = res.botData.tgChatId;
        }
        if (res.isRunning) {
            document.getElementById('status').innerText = "Bot is currently RUNNING! ";
        } else {
            document.getElementById('status').innerText = "Bot is STOPPED. ";
        }
    });
});

document.getElementById('startBtn').addEventListener('click', () => {
    const data = {
        targetDates: document.getElementById('targetDates').value,
        passportNo: document.getElementById('passportNo').value,
        dob: document.getElementById('dob').value,
        email: document.getElementById('email').value,
        tgToken: document.getElementById('tgToken').value,
        tgChatId: document.getElementById('tgChatId').value
    };

    chrome.storage.local.set({ botData: data, isRunning: true }, () => {
        document.getElementById('status').innerText = "Data Saved & Bot Started! 🟢";
        
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.reload(tabs[0].id);
        });
    });
});

document.getElementById('stopBtn').addEventListener('click', () => {
    chrome.storage.local.set({ isRunning: false }, () => {
        document.getElementById('status').innerText = "Bot STOPPED. 🔴";
    });
});