var req = require('request');
var APP_NAME = process.env.APP_NAME;
var ROOT_URL = 'https://' + APP_NAME + '.herokuapp.com';
var GUIDE_MESSAGE = '以下URLからSalesforce組織にログインし、機能を有効にしてください。 ' + ROOT_URL + '/salesforce/';
var LINE_REPLY_URL = 'https://api.line.me/v2/bot/message/reply';
var LINE_TOKEN = process.env.LINE_APP_ACCESS_TOKEN;

// パブリック関数
exports.stageZero = function (replyToken){
    console.log('stage: zero');
    sendReply(replyToken, [elmText(GUIDE_MESSAGE)]);    
};
exports.stageInit = function (replyToken){
    console.log('stage: init');
    sendReply(replyToken, [elmText('検索しました。')]);
};
exports.codeConfirmed = function (replyToken){
    sendReply(replyToken, [elmText('認証コードが確認できました。最後にメールアドレスをメッセージしてください。')]);
};
exports.notYetConfirmCode = function (replyToken){
    sendReply(replyToken, [elmText('認証コードが確認できていません。もう一度認証コードを入力してください。最初からやり直す場合は' + ROOT_URL + '/salesforce/\nにアクセスしてください。')]);
};
exports.notYetConfirmEmail = function (replyToken){
    sendReply(replyToken, [elmText('認証コードが確認できていません。もう一度メールアドレスを入力してください。最初からやり直す場合は' + ROOT_URL + '/salesforce/\nにアクセスしてください。')]);
};
exports.codeNotConfirmed = function (replyToken){
    sendReply(replyToken, [elmText('認証コードが確認できません。もう一度おたしかめの上メッセージしてください。')]);
};
exports.home = function (replyToken){
    var sendData = [elmTemplate(
        'セールスフォースへようこそ！メニューを選択してください。', elmButtons(
            '' + ROOT_URL + '/resource/img/class1.png',
            'セールスフォースへようこそ',
            '実行したいメニューを選択してください',
            [elmPostbackAction('データ探索', 'search'),elmPostbackAction('ログアウト', 'logout')]
        ))];
    console.log(JSON.stringify(sendData));
    sendReply(replyToken, sendData);
};
exports.showDetail = function (objectData, replyToken){
    var message = '';
    var fields = objectData.fields;
    var record = objectData.data;
    for(var i in fields){
        var field = fields[i];
        if(field && field.label){
            message += '【' + field.label + '】\n';
            for (var ii in field.layoutComponents){
                var column = field.layoutComponents[ii].details.name;
                if (column && record[column]){
                    message += record[column];
                }
            }
            message += '\n\n';
        }
    }    
    sendReply(replyToken, [elmText(message)]);
};
exports.showListviews = function (obj, replyToken, option){
    try{
        var searchWord;
        if(option && option.searchWord){
            searchWord = option.searchWord;
        }
        var count = 0;
        var thisMaxCount = 0;
        var thisPage = 1;
        if (option && option.pageNumber){
            thisPage = option.pageNumber;
        }
        var eColumns = [];
        var count = 0;
        for (var key in obj.listViews){
            var lv = obj.listViews[key];
            if(!searchWord || searchWord && lv.Name.indexOf(searchWord) != -1){
                count += 1;
                var eColumn = elmColumn(
                    '' + ROOT_URL + '/resource/img/class3.png',
                    lv.Name,
                    obj.label + 'のリストビュー',
                    [elmPostbackAction('このリストビューで探索', 'view/' + obj.name + '/' + lv.Id), elmPostbackAction('ホームに戻る', 'home')]
                );
		if(count > (parseInt(thisPage) * 5 - 5) && count < (parseInt(thisPage) * 5 + 1)){
                    eColumns.push(eColumn);
                    thisMaxCount = count;
                }
            }
        }
        var eTemplate = [elmTemplate('リストビューを選択してください。', elmCarousel(eColumns))];
        if (count > thisMaxCount){
            eTemplate.push(nextPageNotification(count, thisPage, option.thisPostBack, searchWord));
        }
        sendReply(replyToken, eTemplate);
    } catch(e){
        console.log('ERROR: ' + e);
    }
    
};
exports.showRecords = function (obj, replyToken, option){
    try{
        var objectName = obj.objectName;
        var fieldMap = obj.fieldMap;
        var searchWord;
        if(option && option.searchWord){
            searchWord = option.searchWord;
        }
        var count = 0;
        var thisMaxCount = 0;
        var thisPage = 1;
        if (option && option.pageNumber){
            thisPage = option.pageNumber;
        }
        var eColumns = [];
        for (var key in obj.records){
            var record = obj.records[key].columns;
            var showText = '';
            var rid = '';
            var rname = '';
            var searchWordHit = false;
            for (var ke in record){
                var column = record[ke];
                if (column.fieldNameOrPath == 'Id'){
                    rid = column.value;
                } else {
                    if (column.value && searchWord && column.value.indexOf(searchWord) != -1){
                        searchWordHit = true;
                    }
                    if (column.fieldNameOrPath == 'Name'){
                        rname = column.value;
                    } else {
                        showText += '【' + (fieldMap[column.fieldNameOrPath] || column.fieldNameOrPath) + '】 ' + column.value + '\n';
                    }
                }
            }
            if (!searchWord || searchWord && searchWordHit){
                count += 1;
		if(count > (parseInt(thisPage) * 5 - 5) && count < (parseInt(thisPage) * 5 + 1)){
                    var eColumn = elmColumn(
                        '' + ROOT_URL + '/resource/img/class4.png',
                        rname,
                        showText,
                        [elmPostbackAction('詳細を表示', 'detail/' + objectName + '/' + rid),elmPostbackAction('ホームに戻る', 'home')]
                    );
                    eColumns.push(eColumn);
                    thisMaxCount = count;
                }
            }
        }
        var eTemplate = [elmTemplate('リストビューを選択してください。', elmCarousel(eColumns))];
        if (count > thisMaxCount){
            eTemplate.push(nextPageNotification(count, thisPage, option.thisPostBack, searchWord));
        }
        sendReply(replyToken, eTemplate);
    } catch(e){
        console.log('ERROR: ' + e);
    }    
};
exports.showAllObjects = function (objs, replyToken, option){
    var eColumns = [];
    console.log('Object size: ' + objs.length);
    try{
        var searchWord;
        if(option && option.searchWord){
            searchWord = option.searchWord;
        }
        var count = 0;
        var thisMaxCount = 0;
        var thisPage = 1;
        if (option && option.pageNumber){
            thisPage = option.pageNumber;
        }
        for(var key in objs){
            var obj = objs[key];
            if (!searchWord || searchWord && obj.label.indexOf(searchWord) != -1){
                count += 1;
                var eColumn = elmColumn(
                    '' + ROOT_URL + '/resource/img/class2.png',
                    obj.label,
                    '何をしますか？',
                    [elmPostbackAction('リストビューを表示', 'listview/' + obj.name),elmPostbackAction('ホームに戻る', 'home')]
                );
                if(count > (parseInt(thisPage) * 5 - 5) && count < (parseInt(thisPage) * 5 + 1)){
                    eColumns.push(eColumn);
                    thisMaxCount = count;
                }
            }
        }
        var eTemplate = [elmTemplate('オブジェクトを選択してください。', elmCarousel(eColumns))];
        if (count > thisMaxCount){
            eTemplate.push(nextPageNotification(count, thisPage, option.thisPostBack, searchWord));
        }
        sendReply(replyToken, eTemplate);
    } catch(e){
        console.log('ERROR: ' + e);
    }
};
exports.emailNotConfirmed = function (replyToken){
    sendReply(replyToken, [elmText('メールアドレスが確認できません。もう一度おたしかめの上メッセージしてください。')]);
};
exports.logoutComplete = function (replyToken){
    sendReply(replyToken, [elmText('ログアウトしました。'), elmText(GUIDE_MESSAGE)]);
};

// プライベート関数
function nextPageNotification(count, thisPage, postBack, searchWord){
    var searchParam =
	searchWord && searchWord.length > 0 ? 'sword=' + searchWord + '&':
	'';
    return elmTemplate(
        '次のページを表示しますか？',
        elmConfirm('' + thisPage + 'ページ目 / 全' + Math.ceil(parseInt(count)/5) + 'ページ\n\n次ページを表示しますか？\n\n【Tips】検索ワードをメッセージ送信することで、表示結果を絞り込むことができます。', [
            elmPostbackAction('はい', postBack + '#' + searchParam + 'page=' + (parseInt(thisPage) + 1)),
            elmPostbackAction('いいえ', postBack + '#' + searchParam + 'page=' + (parseInt(thisPage)))
        ])
    );
}
function sendReply(replyToken, messages){
    console.log('SEND REPLY');
    console.log(JSON.stringify(messages));
    var sendBody = {
        "replyToken": replyToken,
        "messages": messages
    };
    req.post({
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + LINE_TOKEN},
        url : LINE_REPLY_URL,
        body : JSON.stringify(sendBody)
    }, function(err, response, body){
        if(err){

        } else {
            console.log('BODY: ' + body);
        }
    });
}
function elmPostbackAction(label, data, text){
    return {
        'type' : 'postback',
        'label' : shrink(label, 20),
        'data' : data,
        'text' : text
    };
}
function elmMessageAction(label, text){
    return {
        'type': 'message',
        'label' : shrink(label, 20),
        'text' : text
    };
}
function elmText(text){
    return {
        'type' : 'text',
        'text' : shrink(text, 2000)
    }
}
function elmButtons(thumbnailImageUrl, title, text, actions){
    return {
        'type' : 'buttons',
        'thumbnailImageUrl' : thumbnailImageUrl,
        'title' : shrink(title, 40),
        'text' : shrink(text, 60),
        'actions' : actions
    };
}
function elmConfirm(text, actions){
    return {
        'type' : 'confirm',
        'text' : shrink(text, 240),
        'actions' : actions
    };
}
function elmCarousel(columns){
    return {
        'type' : 'carousel',
        'columns' : columns
    };
}

function elmTemplate(altText, template){
    return {
        'type' : 'template',
        'altText' : altText,
        'template' : template
    };
}
function elmColumn(thumbnailImageUrl, title, text, actions){
    return {
        'thumbnailImageUrl' : thumbnailImageUrl,
        'title' : shrink(title, 40),
        'text' : shrink(text, 60),
        'actions' : actions
    };
}
function shrink(otext, len){
    var ret;
    if(otext && otext.length > (len - 3)){
        ret = otext.substring(0, (len - 3)) + '..';
    } else if (!otext){
        ret = '---';  
    } else {
        ret = otext;
    }
    return ret;
}
