var jsforce = require('jsforce');
var req = require('request');
var CLIENT_ID = process.env.SFDC_APP_CLIENT_ID;
var CLIENT_SECRET = process.env.SFDC_APP_CLIENT_SECRET;
var REDIRECT_URI = 'https://' + process.env.APP_NAME + '.herokuapp.com/salesforce/callback';
var API_VERSION = process.env.SFDC_APP_API_VERSION;
var request = require('request');
var TOKEN_REQUEST_URI = 'https://login.salesforce.com/services/oauth2/token';

// パブリック関数
exports.getInitialURL = function (){
    return 'https://login.salesforce.com/services/oauth2/authorize?' +
        'response_type=code&client_id=' + CLIENT_ID +
        '&redirect_uri=' + REDIRECT_URI;
};
exports.getRecordsByListview = function(atoken, instance, objectName, viewId){
    return new Promise (function(resolve, reject){  
        var rurl = instance + API_VERSION + '/sobjects/' + objectName +
            '/listviews/' + viewId + '/results';
        request.get({
	    headers: {'Authorization': 'Bearer ' + atoken},
	    url: rurl
        }, function(err, response, body){
            if(err){
                reject('refreshToken');
            } else {                
	        var jsond = JSON.parse(body);
                jsond.objectName = objectName;
                var conn = login(atoken, instance);
                conn.describe(objectName, function(err, record){
                    if(err){
                    } else {
                        var hash = {};
                        for (var i in record.fields){
                            var field = record.fields[i];
                            hash[field.name] = field.label;
                        }
                        jsond.fieldMap = hash;
                        resolve(jsond);
                    }
                });
            }
        });
    });
}
exports.passCertification = function(req){
    return new Promise (function(resolve, reject){  
        var rurl = TOKEN_REQUEST_URI;
        var postd =
	    'code=' + req.query.code +
	    '&grant_type=' + 'authorization_code'+
	    '&client_id=' + CLIENT_ID +
	    '&client_secret=' + CLIENT_SECRET +
	    '&redirect_uri=' + REDIRECT_URI;
        console.log("CALLOUT TO SALESFORCE WITH CODE");
        console.log("DATA: " + postd);
        request.post({
	    headers: {'content-type': 'application/x-www-form-urlencoded'},
	    url: rurl,
	    body : postd
        }, function(err, response, body){
            if(err){
                reject(err);
            } else {
	        console.log("BODY: " + body);
	        var jsond = JSON.parse(body);
                resolve(jsond);
            }
        });        
    });
}
exports.refreshCertification = function(rtoken){
    return new Promise (function(resolve, reject){  
        var rurl = TOKEN_REQUEST_URI;
        var postd =
	    'grant_type=' + 'refresh_token' +
            '&refresh_token=' + rtoken +
	    '&client_id=' + CLIENT_ID +
	    '&client_secret=' + CLIENT_SECRET +
	    '&format=' + 'json';
        console.log("CALLOUT TO SALESFORCE WITH REFRESH TOKEN");
        console.log("DATA: " + postd);
        request.post({
	    headers: {'content-type': 'application/x-www-form-urlencoded'},
	    url: rurl,
	    body : postd
        }, function(err, response, body){
	    console.log("BODY: " + body);
	    var jsond = JSON.parse(body);
            resolve(jsond.access_token);
        });        
    });
}
exports.logout = function (atoken, instance){
    return new Promise(function(resolve, reject){
        console.log('instance: '+ instance);
        console.log('atoken: ' + atoken);
        var conn = login(atoken, instance);
        logout(conn).then(
            function(ret){
                resolve(ret);
            }
        ).catch(
            function(err){
            }
        );
    });
};
exports.getMyEmail = function (atoken, me, instance){
    return new Promise(function(resolve, reject){
        console.log('instance: '+ instance);
        console.log('atoken: ' + atoken);
        console.log('me: ' + me);
        var conn = login(atoken, instance);
        conn.sobject("User").retrieve(me, function(err, user) {
            if (err) {
                console.log('ERROR: ' + err);
                resolve('a');
            } else {
                console.log('EMAIL: ' + user.Email);
                resolve(user.Email);
            }
        });
    });
};
exports.getDetailById = function (atoken, instance, objectName, recordId){
    return new Promise(function(resolve, reject){
        var rurl = instance + API_VERSION + '/compactLayouts?q=' + objectName;
        var header = {'Authorization' : 'Bearer ' + atoken};
        request.get({
            headers: header,
            url: rurl
        }, function(err, response, body){
            if(err){
                reject('refreshToken');
            } else {
                var jsond = JSON.parse(body);
                var fields = jsond[objectName].fieldItems;
                var conn = login(atoken, instance);
                conn.sobject(objectName).retrieve(recordId, function(err, record){
                    var ret = {};
                    ret.data = record;
                    ret.fields = fields;
                    resolve(ret);
                });                
            }
        });
    });
};
exports.getObject = function (atoken, instance, dataTarget){
    return new Promise(function(resolve, reject){
        console.log('instance: '+ instance);
        console.log('atoken: ' + atoken);
        console.log('target: ' + dataTarget);
        var conn = login(atoken, instance);
        conn.query(
            "SELECT Id, Name FROM ListView WHERE SobjectType = '" +
                dataTarget + "'",
            function(err, result) {
                if (err) {
                    reject('refreshToken');
                } else {
                    conn. describe$(dataTarget, function(err, res) {
                        if (err) { console.log(err); }
                        res.listViews = result.records;
                        res.listViewCount = res.length;
                        resolve(res);
                           });
                }
            });
    });
};
exports.getAllObjects = function (atoken, instance){
    return new Promise(function(resolve, reject){
        console.log('instance: '+ instance);
        console.log('atoken: ' + atoken);
        var conn = login(atoken, instance);
        conn.query('SELECT SobjectType FROM ListView GROUP BY SobjectType', function(err, result){
            if(err){
                reject('refreshToken');
            } else {
                var ary = result.records;
                var listviewable = [];
                for (var key in ary){
                    var obj = ary[key];
                    var objName = obj.SobjectType;
                    if(obj && objName && !objName.match(/^0/) && !objName.match(/__x$/)){
                        listviewable.push(objName);
                    }
                }
                conn.describeGlobal$(function(err, res) {
                    if (err) {
                        console.log('ERROR: ' + err);
                        reject();
                    } else {
                        console.log('Num of SObjects: ' + res.sobjects.length);
                        var retObject = [];
                        for(var key in res.sobjects){
                            var obj = res.sobjects[key];
                            if(obj.searchable && obj.createable && obj.updateable && obj.layoutable){
                                if(listviewable.indexOf(obj.name) >= 0){
                                    retObject.push(obj);
                                }
                            }
                        }
                        resolve(retObject);
                    }
                });
            }
        });
    });
};

// プライベート関数
function login(atoken, instance){
    var conn = new jsforce.Connection({
        instanceUrl : instance,
        accessToken : atoken
    });
    return conn;
}
function logout(conn){
    return new Promise(function(resolve, reject){
        conn.logout(function(err) {
            if (err) {
                reject(err);
            } else {
                resolve('logoutcomplete');
            }
        });
    });   
}
