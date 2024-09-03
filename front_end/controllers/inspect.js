var inspectModel = require('../models/inspect-model.js');



module.exports={
    inspect:function(req, res) {
        let json = req.body

        // if (!(json.hasOwnProperty("select"))) {
        //     res.json({success: false, result: "Body must have 'select' key!"})
        //     return
        // }

        inspectModel.doInspect(JSON.stringify(json),
        function (result) {
            res.json({success: true, result: result})
        },
        function (error) {
            res.json({success: false, result: error})
        })
    },
}