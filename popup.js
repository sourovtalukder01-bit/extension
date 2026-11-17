document.addEventListener('DOMContentLoaded', () => {

    const typeSelect = document.getElementById('typeValue');
    const bookingForSelect = document.getElementById('bookingForValue');
    const targetDatesInput = document.getElementById('targetDates');
    const passportNoInput = document.getElementById('passportNo');
    const dobInput = document.getElementById('dob');
    const emailInput = document.getElementById('email');
    const tgTokenInput = document.getElementById('tgToken');
    const tgChatIdInput = document.getElementById('tgChatId');
    
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const statusText = document.getElementById('status');

    chrome.storage.local.get(['botData', 'isRunning'], (result) => {
        if (result.botData) {
            typeSelect.value = result.botData.typeValue || "0";
            bookingForSelect.value = result.botData.bookingForValue || "0";
            targetDatesInput.value = result.botData.targetDates || "";
            passportNoInput.value = result.botData.passportNo || "";
            dobInput.value = result.botData.dob || "";
            emailInput.value = result.botData.email || "";
            tgTokenInput.value = result.botData.tgToken || "";
            tgChatIdInput.value = result.botData.tgChatId || "";
        }
        
     
        if (result.isRunning) {
            statusText.innerText = "Status: Bot is RUNNING 🟢";
            statusText.style.color = "green";
        } else {
            statusText.innerText = "Status: Bot is STOPPED 🔴";
            statusText.style.color = "red";
        }
    });

  
    startBtn.addEventListener('click', () => {
      
        if (!targetDatesInput.value || !passportNoInput.value || !dobInput.value) {
            statusText.innerText = "Please fill in all required fields!";
            statusText.style.color = "orange";
            return;
        }

   
        const botData = {
            typeValue: typeSelect.value,
            bookingForValue: bookingForSelect.value,
            targetDates: targetDatesInput.value,
            passportNo: passportNoInput.value,
            dob: dobInput.value,
            email: emailInput.value,
            tgToken: tgTokenInput.value,
            tgChatId: tgChatIdInput.value
        };

       
        chrome.storage.local.set({ 
            botData: botData, 
            isRunning: true,
            bookedCount: 0 
        }, () => {
            statusText.innerText = "Status: Bot Started Successfully! 🟢";
            statusText.style.color = "green";
            
            
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs[0]) {
                    chrome.tabs.reload(tabs[0].id);
                }
            });
        });
    });

    
    stopBtn.addEventListener('click', () => {
        chrome.storage.local.set({ isRunning: false }, () => {
            statusText.innerText = "Status: Bot STOPPED 🔴";
            statusText.style.color = "red";
        });
    });
});