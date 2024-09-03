const conn = require("../config/connection.js")
const request = require('request');

module.exports={
    doInspect:async function(data, success, error) {
        let options = {
            url: `${conn.dapp_inspect_url}/${data}`,
        };

        request.get(options, (err, res, body) => {
            if (err) {       
                console.log(err)
                error(err)
                return
            }

            body = JSON.parse(body)
            if (!body.reports[0]) {
                error("Don't have a report.")
                return
            }
            let payload_str = conn.web3.utils.hexToUtf8(body.reports[0].payload)

            try {
                success(JSON.parse(payload_str))
            }
            catch (Error) {
                error(payload_str)
            }
        })
    },
}