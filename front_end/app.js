var express = require("express");
var bodyParser = require('body-parser')

require('dotenv').config()

var app = express();

app.set("view engine", "ejs");
app.set("views", "./views");
app.use(express.static("./public"));
app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json())

var home_router = require('./routes/home.js');
app.use('/', home_router);

const PORT = process.env.PORT || 3000;

app.listen(PORT, function(){
	console.log("Server ON");
});
