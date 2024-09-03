function loadFileContent(){
    var fileToLoad = document.getElementById("scheduleFile").files[0];

    var fileReader = new FileReader();
    fileReader.onload = function(fileLoadedEvent){
        textFromFileLoaded = fileLoadedEvent.target.result;
        //console.log(textFromFileLoaded)
    };

    fileReader.readAsText(fileToLoad, "UTF-8");
}

function do_json_submit(body, url, is_async) {
    if (url == undefined) { return }
    if (is_async == undefined) { is_async = true }

    body = JSON.stringify(body)

    return $.ajax({
        url: url,
        type: "POST",
        async: is_async,
        data: body,
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        cache : false
    });
}

async function scheduleSubmit() {
    let input

    if (textFromFileLoaded) {
        try {
            input = JSON.parse(textFromFileLoaded)
        }
        catch (error) {
            alert(error)
            return
        }
    }

    if (!input) {
        alert("Error: Nothing to send.")
        return
    }

    input.new_schedule = true // must add to Cartesi Machine's back-end
    input = JSON.stringify(input)
    metamask_send(input)

    // hide modal window
    let myModalEl = document.getElementById('scheduleModal')
    let modal = bootstrap.Modal.getInstance(myModalEl) // Returns a Bootstrap modal instance
    modal.toggle()
};

async function fineSubmit() {
    let input = {}
    input.bus_id = document.getElementById('fineModalBusId').value
    input.trip_id = document.getElementById('fineModalTripId').value
    input.ts = document.getElementById('fineModalTimestamp').value
    input.lat = parseFloat(document.getElementById('fineModalLat').value)
    input.lon = parseFloat(document.getElementById('fineModalLng').value)

    let form_is_valid = true
    if (input.bus_id == "") form_is_valid = false
    if (input.trip_id == "") form_is_valid = false
    if (input.ts == "") form_is_valid = false

    if (!form_is_valid) {
        alert("Please, complete the Send Trip Info Form.")
        return
    }

    
    let date_time = new Date(input.ts).getTime()
    if (!date_time) {
        alert("Invalid Timestamp! Must be YYYY-mm-dd HH:MM:SS")
        return
    }
    
    input = JSON.stringify(input)
    metamask_send(input)

    // hide modal window
    let myModalEl = document.getElementById('fineModal')
    let modal = bootstrap.Modal.getInstance(myModalEl) // Returns a Bootstrap modal instance
    modal.toggle()
}

async function query_chart_data(epoch, select, callback) {
    if (epoch == undefined) { return }
    if (select == undefined) { return }
    if (callback == undefined) { return }
    let body = {"epoch": epoch,"select": select}

    try {
        do_json_submit(body, "/query").then(callback)
    } catch(err) {
        alert(err)
    }
    
}

async function inspect_query(option, callback, is_async) {
    if (option == undefined) { return }
    if (callback == undefined) { return }

    try {
        callback(await do_json_submit(option, "/inspect", is_async))
    } catch(err) {
        alert(err);
    }
}

// METAMASK HANDLING
function handle_accounts(accounts) {
    if (accounts.length === 0) {
        // MetaMask is locked or the user has not connected any accounts
        throw 'Please connect to MetaMask.'
    }
    user_account = accounts[0]
}

function handle_chainid(chainId) {
    if (chainId != back_end_chainid) {
        console.log(`New chainID: ${chainId}`)
        throw `Set Metamask's Network to the one with ID: ${back_end_chainid}`
    }
}

async function try_metamask_connect() {
    try {
        await metamask_connect()
    }
    catch (e) {
        alert(e)
        return false
    }
    
    return true
}

async function metamask_connect() {
    if (typeof window.ethereum === 'undefined') {
        throw "Please, install Metamask to use the application."
    }
    if (await window.ethereum.request({ method: 'eth_chainId' }) != back_end_chainid) {
        throw `Please, set Metamask Network to the one with ID: ${back_end_chainid}`
    }
    if (!user_account) {
        try {
            let accounts = await ethereum.request({ method: 'eth_requestAccounts' })
            handle_accounts(accounts)    
        } catch (e) {
            throw `Code: ${e.code}\nMessage: ${e.message}`
        }
    }
    if (!web3) {
        try {
            web3 = new Web3(Web3.givenProvider)
            input_contract = new web3.eth.Contract(metamask_conn_config.abi, metamask_conn_config.address)    
        } catch (e) {
            throw `Code: ${e.code}\nMessage: ${e.message}`
        }
    }
}

async function metamask_send(input) {
    if (!web3) {
        alert("Please, connect to Metamask first.")
        return
    }
    
    let input_hex = web3.utils.utf8ToHex(input)
    input_contract.methods.addInput(input_hex).send({ from: user_account })
    .then(console.log)
    .catch(console.log)
}

if (typeof window.ethereum !== 'undefined') {
    window.ethereum.on('chainChanged', (chainid) => {
        try { 
            handle_chainid(chainid)
        }
        catch (e) {
            alert(e)
        }
    });
    
    window.ethereum.on('accountsChanged', handle_accounts);

    window.ethereum.on('disconnect', () => { user_account = null })
}

// prevents page from reloading
$( "#schedule-btn-submit" ).click(function( event ) {
    event.preventDefault();
})

// prevents page from reloading
$( "#fine-btn-submit" ).click(function( event ) {
    event.preventDefault();
})
