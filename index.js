var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var main = require('./app/main.js');

// app準備
app.set('port', (process.env.PORT || 5000));
app.use('/resource', express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
// GETメソッド定義
app.get('/salesforce/', function(req,res){
    main.appGetSalesforce(res);
});
app.get('/salesforce/callback', function(req,res){
    console.log('HEADER: ' + JSON.stringify(req.headers));
    console.log('BODY: ' + JSON.stringify(req.body));
    main.appGetSalesforceCallback(req, res);
});
// POSTメソッド定義
app.post('/line/callback', function(req, res) {
    console.log('HEADER: ' + JSON.stringify(req.headers));
    console.log('BODY: ' + JSON.stringify(req.body));
    main.appPostLineCallback(req, res);
});
// appスタート
app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
});
