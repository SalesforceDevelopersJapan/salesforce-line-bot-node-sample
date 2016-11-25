var mongodb = require("mongodb");
var AUTH_C = "auths";
var USER_C = 'users';
var db;
var crypto = require("crypto");
var line = require('./line.js');
var salesforce = require('./salesforce.js');

// MongoDB準備
mongodb.MongoClient.connect(process.env.MONGODB_URI, function (err, database) {
    if (err) {
        console.log('MONGO DB CONNECTION ERROR: ' + err);
        process.exit(1);
    } else {
        db = database;
        console.log("Database connection ready");
    }
});
// パブリック関数
exports.appGetSalesforce = function(res){
    var rurl = salesforce.getInitialURL();
    res.redirect(302, rurl);
};
exports.appGetSalesforceCallback = function(req, res){
    res.writeHeader(
	200, {'Content-Type': 'text/html; charset=utf-8'}
    );    
    salesforce.passCertification(req).then(
        (jsond) => connectCertificationToCode6(jsond)
    ).then(
        (replyHTML) => sendReply(res, replyHTML)
    );
};
exports.appPostLineCallback = function(req, res){
    response200(res);
    if(isValidMessage(req.headers['x-line-signature'], req.body)){
        if(req.body.events){
            for (var i in req.body.events){
                var evt = req.body.events[i];
                var type = evt.type;
                var userId = evt.source.userId;
                console.log('TYPE: ' + type);
                if(type == 'message'){
                    console.log('TYPE=MESSAGE');
                    evtMessage(evt, userId);
                } else if (type == 'postback'){
                    console.log('TYPE=POSTBACK');
                    evtPostback(evt.replyToken, evt.postback.data, userId);
                }
            }
        }
    } else {
        console.log('ERROR: INVALID MESSAGE');
    }
};
// プライベート関数
function sendReply(res, replyHTML){
    res.write(replyHTML);
    res.end();
}
function connectCertificationToCode6(jsond){
    return new Promise (function(resolve, reject){
        console.log("ACCESS TOKEN: " + jsond.access_token);
        console.log("");
        var rand6 = '';
        for (i=0; i<6; i++){
	    rand6 += getRandomIntString(0, 9);
        }
        var targetDoc = {
            fid : jsond.id
        };
        var insertBody = {
            code6 : rand6,
            atoken : jsond.access_token,
            rtoken : jsond.refresh_token,
            me : jsond.id.match(/[0-9A-Za-z]+$/)[0],
            instance : jsond.instance_url
        };
        db.collection(AUTH_C).updateOne(targetDoc, {$set: insertBody}, {upsert: true}, function(err, doc){
            if(err){
            } else {
	        resolve('<p style="font-size:45px;margin-top:50px;">以下の認証コード6桁をLINEでメッセージ送信してください。</p><br/><br/><center><p style="font-size:90px">' + rand6 + '</p></center><br/><br/><center><a href="line://" style="font-size:55px">LINE起動</a></center>');
            }
        });
    });
}
function response200(res){
    res.writeHeader(200, {'Content-Type': 'text/html'});
    res.end();
}
function evtMessage(evt, userId){
    var messageType = evt.message.type;
    var replyToken = evt.replyToken;
    if (messageType == 'text'){
        evtMessageText(evt, userId, replyToken);
    }    
}
function evtPostback(replyToken, postbackData, userId, searchWord){
    var splits = postbackData.split('#');
    var param = retrieveParams(splits[1]);
    var postData = splits[0];
    var postDatas = postData.split('/');
    var dataType = postDatas[0];
    var dataTarget = postDatas[1];
    var dataTarget2 = postDatas[2];
    var option = packOptions(param, searchWord, postData);
    console.log('DATA: ' + postDatas);
    changeState(userId, postData);
    getStageFromLid(userId).then(
        function(result){
            var stage = result.stage;
            if(stage == 'logined'){
                console.log('STAGE: logined');
                if (dataType == 'search'){
                    evtPostbackSearch(userId, replyToken, option);
                } else if (dataType == 'listview' && dataTarget){
                    evtPostbackListview(userId, replyToken, dataTarget, option);
                } else if (dataType == 'view' && dataTarget2){
                    evtPostbackView(userId, replyToken, dataTarget, dataTarget2, option);
                } else if (dataType == 'new' && dataTarget){
                    evtPostbackNew(userId, replyToken, dataTarget);
                } else if (dataType == 'detail'){
                    evtPostbackDetail(userId, replyToken, dataTarget, dataTarget2);
                } else if (dataType == 'logout'){
                    evtPostbackLogout(userId, replyToken);
                } else if (dataType == 'home'){
                    evtPostbackHome(replyToken);
                }
            } else {
                if(stage == 'unknown' || stage == '' || !stage){
                    line.notYetConfirmCode(replyToken);
                } else if (stage == 'codeConfirmed'){
                    line.notYetConfirmEmail(replyToken);
                }
            }
        }
    );        
}
function evtPostbackHome(replyToken){
    line.home(replyToken);
    changeStage(lid, 'logined');
    changeState(lid, 'home');
}
function retrieveParams(rawParams){
    var param = {};
    if (rawParams){
	console.log(rawParams);
	var str = rawParams.split('&');
	console.log(str);
        for (var key in str){
	    
            var raw = str[key].split('=');
	    console.log(raw);
            param[raw[0]] = raw[1];
        }
    }
    return param;
}
function packOptions(param, searchWord, postData){
    var option = {};
    if(searchWord && searchWord.length > 0){
	option.searchWord = searchWord;
	option.pageNumber = 1;
    } else {
	if(param.page && param.page > 0){
	    option.pageNumber = param.page;
	    option.searchWord = param.sword;
	}
    }
    option.thisPostBack = postData;
    return option;
}
function refreshAccessToken(refresh, result){
    return new Promise(function(resolve, reject){
        if(refresh){
            salesforce.refreshCertification(result.rtoken).then(
                function(atoken){                    
                    updateAccessToken(result.lid, atoken);
                    resolve(result);
                }
            ).catch(
                function(err){
                    reject(err);
                }
            );
        } else {
            resolve(result);
        }

    });
}
function evtPostbackView(userId, replyToken, dataTarget, dataTarget2, option){
    var refresh = false;
    var loop = function(){
        getMdataFromLid(userId).then(
            (result) => refreshAccessToken(refresh, result)
        ).then(
            (result) => salesforce.getRecordsByListview(result.atoken, result.instance, dataTarget, dataTarget2)
        ).then(
            (recordObject) => line.showRecords(recordObject, replyToken, option)
        ).catch(
            function(err){
                console.log('ERROR: ' + err);
                if(refresh){
                    line.stageZero(replyToken);
                    changeStage(userId, 'unknown');
                } else if(err == 'refreshToken') {
                    refresh = true;
                    loop();
                }

            }
        );
    };
    loop();
}
function evtPostbackDetail(userId, replyToken, objectName, recordId){
    var refresh = false;
    var loop = function(){
        getMdataFromLid(userId).then(
            (result) => refreshAccessToken(refresh, result)
        ).then(
            (result) => salesforce.getDetailById(result.atoken, result.instance, objectName, recordId)
        ).then(
            (detailObject) => line.showDetail(detailObject, replyToken)
        ).catch(
            function(err){
                console.log('ERROR: ' + err);
                if(refresh){
                    line.stageZero(replyToken);
                    changeStage(userId, 'unknown');
                } else if(err == 'refreshToken') {
                    refresh = true;
                    loop();
                }

            }
        );
    };
    loop();
}
function evtPostbackListview(userId, replyToken, dataTarget, option){
    var refresh = false;
    var loop = function(){
        getMdataFromLid(userId).then(
            (result) => refreshAccessToken(refresh, result)
        ).then(
            (result) => salesforce.getObject(result.atoken, result.instance, dataTarget)
        ).then(
            (object) => line.showListviews(object, replyToken, option)
        ).catch(
            function(err){
                console.log('ERROR: ' + err);
                if(refresh){
                    line.stageZero(replyToken);
                    changeStage(userId, 'unknown');
                } else if(err == 'refreshToken') {
                    refresh = true;
                    loop();
                }
            }
        );
    };
    loop();
}
function evtPostbackSearch(userId, replyToken, option){
    var refresh = false;
    var loop = function(){    
        getMdataFromLid(userId).then(
            (result) => refreshAccessToken(refresh, result)
        ).then(
            (result) => salesforce.getAllObjects(result.atoken, result.instance)
        ).then(
            (objects) => line.showAllObjects(objects, replyToken, option)
        ).catch(
            function(err){
                console.log('ERROR: ' + err);
                if(refresh){
                    line.stageZero(replyToken);
                    changeStage(userId, 'unknown');
                } else if(err == 'refreshToken') {
                    refresh = true;
                    loop();
                }
            }
        );
    };
    loop();
}
function evtPostbackLogout(userId, replyToken){
    var refresh = false;
    var loop = function(){
        getMdataFromLid(userId).then(
            (result) => refreshAccessToken(refresh, result)
        ).then(
            (result) => salesforce.logout(result.atoken, result.instance)
        ).then(
            function(message){
                removeUserDocument(userId);
                return line.logoutComplete(replyToken);
            }
        ).catch(
            function(err){
                console.log('ERROR: ' + err);
                if(refresh){

                    changeStage(userId, 'unknown');
                    line.stageZero(replyToken);                    
                } else if(err == 'refreshToken') {
                    refresh = true;
                    loop();
                }
            }
        );
    };
    loop();
}
function evtMessageText(evt, userId, replyToken){
    var message = evt.message.text;
    console.log('USER: ' + userId);
    getStageFromLid(userId).then(
        function(result){
            var stage = '';
            if(result){
                stage = result.stage || '';
            }
            console.log('STAGE: ' + stage);
            console.log('MESSAGE: ' + message);
            if (stage == 'unknown' || stage == '' || !stage){
                stageUnknown(message, userId, replyToken);
            } else if (stage == 'codeConfirmed'){
                stageCodeConfirmed(message, userId, replyToken);
            } else if (stage == 'logined'){
                stageLogined(replyToken, userId, message);
            }
        }
    );
}
function stageUnknown(message, userId, replyToken){
    if(message.match(/^[0-9]{6}$/)){
        confirmCode6(message, userId).then(
            function(result){
                if(result){
                    changeStage(userId, 'codeConfirmed');
                    line.codeConfirmed(replyToken);
                } else {
                    line.codeNotConfirmed(replyToken);
                }
            }
        );
    } else {
        line.stageZero(replyToken);
    }
}
function stageCodeConfirmed(message, userId, replyToken){
    getMdataFromLid(userId).then(
        (result) => salesforce.getMyEmail(result.atoken, result.me, result.instance)
    ).then(
        (email) => confirmEmail(email, message)
    ).then(
        (result) => afterConfirmEmail(result, replyToken, userId)
    );
}
function stageLogined(replyToken, userId, message){
    var option = {};
    if (message && message.length > 0){
        updateSearchword(userId, message);
	getMdataFromLid(userId).then(
            (result) => evtPostback(replyToken, result.state, userId, message)
	);
    }
}
function stageNone(replyToken){
    line.stageInit(replyToken);
}
function getRandomIntString(min, max) {
    var nn = Math.floor( Math.random() * (max - min + 1) ) + min;
    return nn.toString();
}
function confirmEmail(email, message){
    return new Promise (function(resolve, reject){
        console.log('Email: ' + email);
        console.log('message: ' + message);
        if(email.length > 5 && message.indexOf(email) != -1){
            console.log('EMAIL MATCH');
            resolve(true);
        } else {
            console.log('EMAIL UNMATCH');
            resolve(false);
        }
    });
}
function afterConfirmEmail(result, replyToken, lid){
    if (result){
        line.home(replyToken);
        changeStage(lid, 'logined');
        changeState(lid, 'home');
    } else {
        line.emailNotConfirmed(replyToken);
    }
}
function getMdataFromLid(lid){
    console.log('LINEuser: ' + lid);
    return new Promise (function(resolve, reject){
        db.collection(USER_C).find({lid: lid}).toArray(function(err, docs){
            if (docs[0] && docs[0].atoken && docs[0].me && docs[0].instance){
                resolve(docs[0]);
            } else {
                reject();
            }
        });
    });
}
function getStageFromLid(lid){
    console.log('LINEuser: ' + lid);
    return new Promise (function(resolve, reject){
        db.collection(USER_C).find({lid: lid}).toArray(function(err, docs){
            if (docs[0] && docs[0].stage){
                resolve(docs[0]);
            } else {
                var result = {};
                result.stage = 'unknown';
                resolve(result);
            }
        });
    });
}
function confirmCode6(code6, lid){
    console.log('CODE: ' + code6 + ' LINEuser: ' + lid);
    return new Promise (function(resolve, reject){
        db.collection(AUTH_C).find({code6: code6}).toArray(function(err, docs){
            if (docs[0] && docs[0].atoken && docs[0].me && docs[0].instance){
                db.collection(USER_C).updateOne(
                    {lid: lid}, {$set:{atoken: docs[0].atoken, rtoken: docs[0].rtoken, fid: docs[0].fid, me: docs[0].me, instance: docs[0].instance}}, {upsert:true}, function(err, doc){
                        if(err){
                            resolve(false);
                        } else {
                            removeAuthDocument(code6);
                            resolve(true);
                        }
                    }); 
            } else {
                resolve(false);
            }
        });
    });
}
function removeAuthDocument(code6){
    db.collection(AUTH_C).deleteOne({code6: code6}, function(err, result){
        console.log('REMOVE AUTH DOCUMENT');
    });
}
function removeUserDocument(lid){
    db.collection(USER_C).deleteOne({lid: lid}, function(err, result){
        console.log('REMOVE AUTH DOCUMENT');
    });
}
function changeStage(lid, stage){
    db.collection(USER_C).updateOne({lid: lid}, {$set:{stage: stage}}, {upsert: true}, function(err, doc){
        if(err){
        } else {
        }
    });
}
function changeState(lid, state){
    db.collection(USER_C).updateOne({lid: lid}, {$set:{state: state}}, {upsert: true}, function(err, doc){
        if(err){
        } else {
        }
    });
}
function updateSearchword(lid, sword){
    db.collection(USER_C).updateOne({lid: lid}, {$set:{sword: sword}}, {upsert: true}, function(err, doc){
        if(err){
        } else {
        }
    });
}
function updateAccessToken(lid, atoken){
    db.collection(USER_C).updateOne({lid: lid}, {$set:{atoken: atoken}}, {upsert: true}, function(err, doc){
        if(err){
        } else {
        }
    });
}
function isValidMessage(sign, body){
    return sign == crypto.createHmac('sha256', process.env.LINE_CHANNEL_SECRET).update(new Buffer(JSON.stringify(body), 'utf8')).digest('base64');

}

