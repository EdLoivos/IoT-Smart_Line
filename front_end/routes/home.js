var express = require('express');

var noticesController = require('../controllers/notices');
var inspectController = require('../controllers/inspect');
var blockchainController = require('../controllers/blockchain')

var router = express.Router();

// index page(dashboard)
router.get('/', noticesController.homePage);
router.post('/', noticesController.homePageFilter);

// query Notices data
router.post("/query", noticesController.query);

// inspect dapp BD (inside Cartesi Machine)
router.post("/inspect", inspectController.inspect);


// submit data (used only for test)
router.post("/submit", blockchainController.submit);



module.exports = router