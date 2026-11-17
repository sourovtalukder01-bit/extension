// const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

import { resolve } from "node:dns"

// async function runBot() {
//     chrome.storage.local.get(['botData', 'isRunning'], async (res) => {
//         if (!res.isRunning) return; 
        
//         console.log("Bot is Running...");
//         const data = res.botData;

//         if(!data){
//             console.log("data not found");
//             return;
//         }


//         const dobInput = document.querySelector("#gp_dateofbirth");

//         if(dobInput){
//             dobInput.value = data.dob;

//             dobInput.dispatchEvent(
//                 new Event("input",{bubbles:true})
//             );

//             dobInput.dispatchEvent(
//                 new Event("change",{bubbles:true})
//             )
//         }
//         const passwportInput = document.querySelector("#gp_passportnumber");

//         if(passwportInput){
//             passwportInput.value = data.passportNo;
//             passwportInput.dispatchEvent(
//                 new Event("input",{bubbles:true})
//             );

//             passwportInput.dispatchEvent(
//                 new Event("change",{bubbles:true})
//             )
//         }

//         await delay(1500);

//         const datesArray = data.targetDates.split(',').map(d => d.trim()); 
        
       




//         for (let i = 0; i < datesArray.length; i++) {
//             let currentDate = datesArray[i];
//             console.log(`Checking Date: ${currentDate}`);

            
//             const dateInput = document.querySelector('#datefrom'); 
//             if(dateInput) {
//                 dateInput.value = currentDate;
//             }

           
//             const searchBtn = document.querySelector('#btn-search');
//             await delay(1000)
//             if(searchBtn) searchBtn.click();

            
//             await delay(30000); 

        

            
//             const slotAvailable = document.querySelector('#resultDiv table#result tbody tr td div[div]'); 

            
//             if (slotAvailable) {
//                 console.log(`Slot Found for ${currentDate}! Booking...`);
                
                
//                 slotAvailable.click();
//                 await delay(1000);
                
//                 const checkbox = document.querySelector('#submissiontext #submitinfo');
//                 if(checkbox) checkbox.click();
                    
//                 await delay(1000)

//             const captchaFrame = document.querySelector('iframe[src*="recaptcha"]');

//             if(captchaFrame) {
//                 console.log("Captcha Found! Turning ON Nopecha...");
//                 await toggleNopecha(true); 
//                 await delay(10000); 
//                 await toggleNopecha(false); 
//             }


                
//                 const bookBtn = document.querySelector('#button-new-appointment');
//                 if(bookBtn) bookBtn.click();

                
//                 sendTelegramMessage(
//                     data.tgToken, 
//                     data.tgChatId, 
//                     ` SUCCESS: Appointment booked for ${currentDate}! Passport: ${data.passportNo}`
//                 );

                
//                 chrome.storage.local.set({ isRunning: false });
//                 break; 
//             } else {
//                 console.log(`No slot for ${currentDate}. Moving to next...`);
//                 await delay(3000);
//             }
//         }
        
    
//         if(res.isRunning) {
//             console.log("All dates checked. Reloading to loop again...");
//             await delay(5000);
//             window.location.reload();
//         }
//     });
// }


// function toggleNopecha(state) {
//     return new Promise((resolve) => {
//         chrome.runtime.sendMessage({ action: "TOGGLE_NOPECHA", state: state }, (res) => {
//             resolve(res);
//         });
//     });
// }


// function sendTelegramMessage(token, chatId, text) {
//     chrome.runtime.sendMessage({ 
//         action: "SEND_TELEGRAM", 
//         token: token, 
//         chatId: chatId, 
//         text: text 
//     });
// }

// if (document.body.innerText.includes("502 Bad Gateway") || !navigator.onLine) {
//     console.log("Network Error. Reloading in 10 seconds...");
//     setTimeout(() => { window.location.reload(); }, 10000);
// } else {

//     window.addEventListener('load', async () => {
//         await delay(2000); 
//         runBot();
//     });
// }





const delay = (ms)=>{
    new Promise(resolve => setTimeout(resolve,ms));
}


const getStorageData = (keys) =>{
    new Promise((resolve)=>{
        chrome.storage.local.get(keys,(res)=> resolve(res))
    })
}




async function runBot(){
    let res = await getStorageData(['botData','isRunning','bookedCount']);

    if(!res.isRunning)return;

    const data = res.botData;

    if(!data){
        return;
    }


    let bookedCount = res.bookedCount || 0;

    if(bookedCount >= 5){
        sendTelegramMessage(data.tgToken,data.tgChatId);

        chrome.storage.local.set({isRunning:false});

        return;
    }


    fillStaticInputs(data);

    await delay(1500);

    const dateArray = data.targetDates.split(',').map(d=>d.trim());


    while(true){
        let currentStatus = await getStorageData(['isRunning']);
        if(!currentStatus.isRunning){
            break;
        }

        if(document.body.innerText.includes("Please login") || document.querySelector('input[type="password"]')){
            sendTelegramMessage(data.tgToken,data.tgChatId);

            chrome.storage.local.set({isRunning:false});
            break;
        }

        if(document.body.innerText.includes("Too many requests") || document.body.innerText.includes("Access Denied")){

            sendTelegramMessage(data.tgToken,data.tgChatId);
            await delay(60000);

            continue;
        }

        let slotBookedInThisCycle = false;


        for(let i =0; i<dateArray.length;i++){
            let currentDate = dateArray[i];


            const dateInput = document.querySelector("#datefrom")

            if(dateInput){
                dateInput.value = currentDate;

                dateInput.dispatchEvent(new Event("input",{bubbles:true}));
                dateInput.dispatchEvent(new Event("change",{bubbles:true}))
            }

            const searchBtn = document.querySelector("#btn-search");

            await delay(500)

            if(searchBtn){
                searchBtn.click();
            }

            await delay(7000);
                

            const slotAvailable = document.querySelector("#resultDiv table#result tbody tr td div[div]")
            

            if(slotAvailable){
                slotAvailable.click();


                await delay(1400)


                const checkbox = document.querySelector('#submissiontext #submitinfo');

                if(checkbox) checkbox.click();

                await delay(1000);


                const captchaFrame = document.querySelector('iframe[src*=recaptcha');

                if(captchaFrame){
                    await toggleNopecha(true);

                    await delay(12000);

                    await toggleNopecha(false);
                }


                const bookBtn = document.querySelector('#button-new-appointment');
                if(bookBtn) bookBtn.click();

                bookedCount +=1;

                chrome.storage.local.set({bookedCount:bookedCount});


                sendTelegramMessage(
                    data.tgToken,
                    data.tgChatId
                );

                slotBookedInThisCycle = true;


                if(bookedCount >= 5){
                    chrome.storage.local.set({isRunning:false});
                }

                break;
            }
            else{
                await delay(2000);
            }
        }

        if(slotBookedInThisCycle){
            break;
        }
        await delay(30000);
    }
}





function fillStaticInputs(data){
    const dobInput = document.querySelector("#gp_dateofbirth");

    if(dobInput){
        dobInput.value = data.dob;

        dobInput.dispatchEvent(new Event("input",{bubbles:true}));
        dobInput.dispatchEvent(new Event("change",{bubbles:true}));
    }

    const passportInput = document.querySelector("#gp_passportnumber");

    if(passportInput){
        passportInput.value = data.passportNo;
        passportInput.dispatchEvent(new Event("input",{bubbles:true}));
        passportInput.dispatchEvent(new Event("change",{bubbles:true}));
    }
}


function toggleNopecha(state){
    return new Promise((resolve)=>{
        chrome.runtime.sendMessage({action:"TOGGLE_NOPECHA",state:state},(res)=>{
            resolve(res);
        })
    }) 
}


function sendTelegramMessage (token,chaId,text){
    chrome.runtime.sendMessage({
        action:"SEND_TELEGRAM",
        token:token,
        chatId:chatId,
        text:text,
    })
}


if(!navigator.onLine){
    setTimeout(()=>{window.location.reload();},
    10000
)
}else{
    window.addEventListener('load',async()=>{
        await delay(2000);

        runBot();
    })
}