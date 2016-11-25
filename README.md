#Salesforce LINE BOT Node sample

Express, MongoDB, JSForceを使ったNode.jsアプリケーション

##概要
LINEユーザが自分のSalesforceアカウントにログインし、LINEのUIからSalesforceのデータにアクセスすることができるLINE BOTのサンプルです。

##前準備
 - [x] Salesforce Developer Edition組織を取得
 - [x] Herokuアカウント登録
 - [x] LINEユーザ登録
 - [ ] ローカル環境へHeroku CLIのインストール（カスタマイズする場合に必要）

##デプロイ
###1. LINEビジネスアカウントの登録
https://business.line.me/  
からLINEビジネスアカウントの登録を完了し、ACCESS TOKENを取得します。

###2. Salesforce外部アプリケーションの登録
https://developer.salesforce.com/docs/atlas.ja-jp.packagingGuide.meta/packagingGuide/connected_app_create.htm  
を参考に登録し、クライアントID,シークレットキーを取得します。

###3. Herokuにデプロイ
[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/SalesforceDevelopersJapan/salesforce-line-bot-node-sample)  
をクリックし、任意の**アプリケーション名**を入力し、以下の要領で環境変数を設定します。

    APP_NAME : (入力した任意のアプリケーション名)
    LINE_APP_ACCESS_TOKEN : (LINEアカウントのアクセストークン)
    LINE_CHANNEL_SECRET : (LINEアカウントのCHANNELシークレットキー)
    SFDC_APP_CLIENT_ID : (SalesforceアプリケーションのクライアントID)
    SFDC_APP_CLIENT_SECRET : (Salesforceアプリケーションのシークレットキー)



###4. LINEビジネスアカウントの設定
1で作成したLINEアカウントのwebhookURLに

    https://(アプリケーション名).herokuapp.com/line/callback

を入力します。

###5. Salesforce外部アプリケーションの設定
2で作成した接続アプリケーションのコールバックURLに

    https://(アプリケーション名).herokuapp.com/salesforce/callback

を入力します。


##カスタマイズ
###ローカル環境準備
ローカル環境にてHeroku CLIでログイン

    $ heroku login
    Enter your Heroku credentials.
    Email: (Herokuアカウントのメールアドレス)
    Password (typing will be hidden): (Herokuアカウントのパスワード)


アプリケーションのソースコードを取得します。

    $ heroku git:clone -a (アプリケーション名)

該当アプリケーションに移動します。

    $ cd (アプリケーション名)

ファイルが見当たらない場合は以下コマンドでコード取得します。

    $ git remote add origin https://github.com/SalesforceDevelopersJapan/salesforce-line-bot-node-sample
    $ git pull origin master

npmパッケージをローカル環境にインストールします。

    $ npm install

heroku上の環境変数をローカルの環境変数にロードするシェルを起動します。

    $ chmod 755 tool/set_local_env_keys.sh
    $ source tool/set_local_env_keys.sh


###アプリケーションのカスタマイズ
アプリケーションファイルはindex.js, app/main.js, app/salesforce.js, app/line.jsになります。自由にカスタマイズしてみてください。


###ローカル環境でのアプリケーション起動
ローカル環境でアプリケーションを起動します。

    $ npm start
    

##ライセンス
MITライセンス