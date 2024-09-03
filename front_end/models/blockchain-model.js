// This model is used for tests
// it adds inputs using an default account


const conn = require("../config/connection.js")


module.exports = {
    getAccounts:async function(callback) {
        conn.web3.eth.getAccounts()
        .then(callback)
    },

    addInput:async function(input, success, fail) {
        const input_hex = conn.web3.utils.utf8ToHex(input)
        //console.log("Input Hex:", input_hex)

        conn.input_contract.methods.addInput(conn.dapp_address,input_hex).send({ from: conn.web3.eth.defaultAccount })
            .then(success)
            .catch(fail)
    },
}