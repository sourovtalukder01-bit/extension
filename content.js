


const delay = (ms)=>{
   return new Promise(resolve => setTimeout(resolve,ms));
}


const getStorageData = (keys) =>{
    return new Promise((resolve)=>{
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
                

            const allSlots = document.querySelectorAll("#resultDiv table#result tbody tr td div[id]")
            

            if(allSlots.length > 0){

                let targetIndex = Math.min(bookedCount,allSlots.length-1);

                const slotAvailable = allSlots[targetIndex];
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

    const typeSelect = document.querySelector("#type");
    if(typeSelect && data.typeValue !== undefined){
        typeSelect.value = data.typeValue;
        typeSelect.dispatchEvent(new Event("change",{bubbles:true}))
    }


    const bookingForSelect = document.querySelector("#bookingfor")

    if(bookingForSelect && data.bookingForValue !== undefined){
        bookingForSelect.value = data.bookingForValue;

        bookingForSelect.dispatchEvent(new Event("change",{bubbles:true}))
    }



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


function sendTelegramMessage (token,chatId,text){
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