const NOPECHA_ID = "dknlfmjaanfblgfdfebhijalfmhmjjjo"; // এখানে আপনার NopeCha এর আসল ID দেবেন

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    
  
    if (message.action === "TOGGLE_NOPECHA") {
        chrome.management.setEnabled(NOPECHA_ID, message.state, () => {
            console.log("NopeCha state changed to: " + message.state);
            sendResponse({ success: true });
        });
        return true; 
    }

    if (message.action === "SEND_TELEGRAM") {
        const url = `https://api.telegram.org/bot${message.token}/sendMessage`;
        fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: message.chatId,
                text: message.text
            })
        })
        .then(res => res.json())
        .then(data => sendResponse({ success: true, data: data }))
        .catch(err => sendResponse({ success: false, error: err }));
        return true;
    }
});