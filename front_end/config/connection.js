const Web3 = require('web3')
const fs = require('fs')


const provider = process.env.PROVIDER // node running Hardhat
const notices_db_url = process.env.GRAPHQL 
const dapp_inspect_url = process.env.INSPECT

const web3 = new Web3(Web3.givenProvider || provider)

if (process.env.USE_LOCAL_ACCOUNT) {
    web3.eth.getAccounts()
    .then(function(result) {
        web3.eth.defaultAccount = result[4] // to set a default "from" parameter
        console.log("Default Account:", web3.eth.defaultAccount)
    })
    .catch(function(error) {
        console.log("Error: Couldn't get accounts list!\n", error)
    });
}

// Cartesi Rollups 0.3
const address = process.env.DAPP_ADDRESS
const input_abi = require(`../${process.env.ABI_INPUT}`)
const input_address = process.env.ABI_ADDRESS
console.log(input_address)

//const rollups_contract_obj = blockchain_obj.contracts.RollupsFacet
//const rollups_contract = new web3.eth.Contract(rollups_contract_obj.abi, address)
const rollups_contract = new web3.eth.Contract(input_abi, address)
const input_contract = new web3.eth.Contract(input_abi, input_address)

module.exports = { 
    web3: web3,
    rollups_contract: rollups_contract,
    input_contract: input_contract,
    notices_db_url: notices_db_url,
    dapp_inspect_url: dapp_inspect_url,
    metamask_conn_config: { abi: input_abi, address: address },
    dapp_address: address
}