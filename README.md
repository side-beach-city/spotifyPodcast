# spotifyPodcast
このプログラムは、Spotify内SBCastのPlaylistを、それぞれのタグに基づき振り分けをする物です。

## 事前準備
1. Spotifyに会員登録
[Spotify](https://open.spotify.com/)
1. Spotify for DevelopersでCLIENT_IDとCLIENT_SECRETを取得
    1. [Spotify for Developers](https://developer.spotify.com/)にログイン
    1. Dashboardにて新しいアプリケーションを作成
    1. Dashboardに記載されているClient IDとClient Secretを取得(Client Secretは`SHOW CLIENT SECRET`を押すと出てきます)

## GAS準備
1. ライブラリにOAuth2認証を登録
    1. ライブラリの右にある+をクリック
    1. IDに`1B7FSrk5Zi6L1rSxxTDgDEUsPzlukDsi4KGuTMorsTQHhGBzBkMun4iDF`を入力
    1. 最新バージョンであることを確認して登録
    1. GASメニュー→プロパティからscriptIDを取得

## Spotify APIの取得と設定
1. Spotify for Developersにログイン
1. EDIT SETTINGSを開き、websiteとRedirectURIを入力
    1. websiteに"http://mysite.com"と入力
    1. RedirectURIに"https://script.google.com/macros/d/<GAS準備で取得したscriptID>/usercallback"と入力

## SpotifyアカウントにGASからログイン
1. GASコードを貼り付け
1. デプロイを押す
1. Webアプリケーションとして導入したのち、発行されたURLにアクセス。ログイン画面が表示されたらSpotifyのアカウントでログインする

## IDシート準備
1. GoogleSpreadSheetで、以下の画像のようにカテゴリとIDを記載する。シート名は"ID"とする
![スプレッドシート例](https://user-images.githubusercontent.com/58931194/155583731-7e065208-3c47-4992-b2d1-40314b63c9c4.png)
1. スプレッドシートのID、シート名を控える

## 実行関数
1. GAS内でコメントに★がついている部分を適宜変更する
1. `createTrigger()`を毎月1日、18時前に実行するようにトリガーを作成する
