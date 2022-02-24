// spotifyの情報入力 
const SPOTIFY_CLIENT_ID = 'Web_Developerから取得できるCLIENT_ID';
const SPOTIFY_CLIENT_SECRET = 'Web_Developerから取得できるCLIENT_SECRET';

// ID類が書かれているスプレッドシートを取得
const ID_spreadSheet = SpreadsheetApp.openById('スプレッドシートのID'); // ★()内変更お願いします。
// ID類が書かれているシートを取得
const ID_sheet = ID_spreadSheet.getSheetByName('ID'); // ★「ID」というシートがある前提での記述になっております。適宜変更してください。
// カテゴリが書かれているシートを取得
const category_sheet = ID_spreadSheet.getSheetByName('category'); // ★「ID」というシートがある前提での記述になっております。適宜変更してください。

// OAuth2認証
// getSpotifyServiceの作成
function getSpotifyService() {
  return OAuth2.createService('spotify')
  // 認証用URL
  .setAuthorizationBaseUrl('https://accounts.spotify.com/authorize')
  // Token取得用URL
  .setTokenUrl('https://accounts.spotify.com/api/token')
  // SPOTIFY_CLIENT_ID
  .setClientId(SPOTIFY_CLIENT_ID)
  // SPOTIFY_CLIENT_SECRET
  .setClientSecret(SPOTIFY_CLIENT_SECRET)
  // 認証完了時用コールバック関数名
  .setCallbackFunction('spotifyAuthCallback')
  // 認証情報格納先
  // アクセストークンやリフレッシュトークンや、有効期限などが格納
  .setPropertyStore(PropertiesService.getUserProperties())
  // プレイリストに書き込む権限を設定
  // 複数必要な場合は半角スペース区切りで設定
  .setScope('playlist-modify-private');
};

// 認証完了時用コールバック関数
// アクセストークンなどの情報をユーザー毎のキャッシュに格納
function spotifyAuthCallback(request) {
  let spotifyService = getSpotifyService();
  // handleCallback でアクセストークンなどを propertyStore に格納する
  let isAuthorized = spotifyService.handleCallback(request);
  
  if (isAuthorized) {
    return HtmlService.createHtmlOutput('認証に成功しました。');
  } else {
    return HtmlService.createHtmlOutput('認証に失敗しました。');
  }
};

// 認証情報リセット用関数
// 主にデバッグ目的等に利用
function resetSpotifyService() {
  let spotifyService = getSpotifyService();
  spotifyService.reset();
};

/*
Main
*/
// WEB アプリケーションとしての認証用コールバック関数
function doGet() {
  let spotifyService = getSpotifyService();
  let outputHtml = '<h1>Spotify API Test</h1>';
  
  if (!spotifyService.hasAccess()) { // 未認証時
    // ログイン用URL取得
    let authorizationUrl = spotifyService.getAuthorizationUrl();
    // HTML組み立て、表示
    outputHtml += '<p>Spotifyにログインしていません。ログインしてください。</p><p><a href="' + authorizationUrl + '" target="_blank">Spotify Login</a></p>';
  } else { // 認証時    
    // アクセストークンの有効期限が1時間となっているのでアクセストークンを都度リフレッシュ
    spotifyService.refresh();
    let accessToken = spotifyService.getAccessToken();
    
    //　自身の情報を取得
    outputHtml += (function () {
      let fetchResult = UrlFetchApp.fetch('https://api.spotify.com/v1/me', {
        headers: {
          Authorization: 'Bearer ' + accessToken
        }
      });
      let statusCode = fetchResult.getResponseCode();
      let content = JSON.parse(fetchResult.getContentText());
      return '<h2>ユーザー情報</h2><pre>' + JSON.stringify(content, null, 4) + '</pre>';
    })();
  }    
  return HtmlService.createHtmlOutput(outputHtml);
};

// 定期実行用サンプル
function timeTriggerSampleFunction() {
  let spotifyService = getSpotifyService();
  // アクセストークンの有効期限が1時間となっているのでアクセストークンを都度リフレッシュ
  spotifyService.refresh();
  let accessToken = spotifyService.getAccessToken();
  let fetchResult = UrlFetchApp.fetch('https://api.spotify.com/v1/me/player/currently-playing?market=JP', {
    headers: {
      Authorization: 'Bearer ' + accessToken,
      // 下記を定義しておかないとトラックやアーティスト情報が英語になってしまう
      'Accept-Language': 'ja,en'
    }
  });
  let statusCode = fetchResult.getResponseCode();
  let content = JSON.parse(fetchResult.getContentText() || '{}');
  let track, artist, displayStr;
  if (statusCode === 200) {
    track = content.item.name;
    artist = content.item.artists[0].name;
    displayStr = 'NowPlaying：' + track + ' / ' + artist;
  } else {
    displayStr = '再生中の曲はありません';
  }
  let rss_array = get_rss();
  let rss_title = rss_array[0];
  let rss_category = rss_array[1];
  getPodcast(accessToken, rss_title, rss_category);
  return displayStr;
  
};

// RSSからタイトルとカテゴリを抽出する処理
function get_rss() {

  // フィードURL
  let my_rss = ID_sheet.getRange(2,2).getValue(); // ★B2に格納している値を取得。適宜変更してください。
  // カテゴリ配列
  let category_List = category_sheet.getRange(2,1,category_sheet.getLastRow() - 1).getValues(); // ★categoryシートのA列の値を取得。適宜変更してください。 
  
  // category_Listだと二次元配列なので一次元配列にする処理
  let category_array = [];
  for (let i = 0; i < category_List.length; i++) {
    category_array.push(category_List[i][0]);
  }
  Logger.log(category_array);
  let category = "";

  // フィードを取得
  let rss_data = UrlFetchApp.fetch(my_rss);
  // XMLをパース
  let rss_xml = XmlService.parse(rss_data.getContentText());
  // 各データの要素を取得
  let rss_entries = rss_xml.getRootElement().getChildren('channel')[0].getChildren('item');
  let category_length = rss_entries[0].getChildren("category").length;
  let title = rss_entries[0].getChildText("title");
      
      for (let i = 0; i < category_length; i++) {
        let category_text = rss_entries[0].getChildren("category")[i].getText();
        /*
        行いたい処理
        ・category_arrayの中にcategory_textが存在するか探索する
        ・探索し、あったら出力
        ・なかった場合
          １．カテゴリ配列の最後で無ければループを続ける
          ２．カテゴリ配列の最後であればエラーを出力
        */
        category = category_array.find(element => element === category_text);
        if(category != null) {
          category = category_text;
          break;
          }else{
            if (i === 3) {
              throw new Error('Required');
            }
          }
      }
    return [title, category];
}


function getPodcast(token, title, category) {

// プレイリストを取得

// SBCastプレイリストのID
let SBCast_ID = ID_sheet.getRange(3,2).getValue(); // ★B3に格納している値を取得。適宜変更してください。

  // API
  let epEndpoint = 'https://api.spotify.com/v1/shows/' + SBCast_ID + '/episodes';
  let epOptions = {
    'method': 'get',
    'headers': {
      'Authorization': 'Bearer ' + token
    }
  };
  let response = UrlFetchApp.fetch(epEndpoint, epOptions);
  
  // 対象プレイリスト内のエピソードをすべて取得
  let targetPlaylist = JSON.parse(response).items;
  
  // 変数の初期化
  let podcast_name = ""; // 対象のポッドキャストエピソードの名前
  let podcast_uri = ""; // 対象のポッドキャストエピソードのURI

  // ポッドキャストの最新話なら名前とURIを変数に格納
  if(targetPlaylist[0]){
    podcast_name = targetPlaylist[0].name;
    podcast_uri = targetPlaylist[0].uri;
  };

// RSSで取得したtitleとpodcast_nameが同一であれば以下処理を行う
if (title == podcast_name) {

  // 振り分けるプレイリストIDを入れる変数
  playListID = '';

// プレイリストに指定エピソードを格納

  // カテゴリによって格納するプレイリストを変更する
  let addplEndpoint = '';
  if (category == '地域のつながり') {
    playListID = ID_sheet.getRange(4,2).getValue();
  }else if(category == '親と子のやすらぎの場') {
    playListID = ID_sheet.getRange(5,2).getValue();
  }else if(category == '学びと暮らし') {
    playListID = ID_sheet.getRange(6,2).getValue();
  }else if(category == '地域と企業') {
    playListID = ID_sheet.getRange(7,2).getValue();
  }else if(category == 'コミュニティカフェ') {
    playListID = ID_sheet.getRange(8,2).getValue();
  }else if(category == 'ITに関わるコミュニティ') {
    playListID = ID_sheet.getRange(9,2).getValue();
  }

  addplEndpoint = 'https://api.spotify.com/v1/playlists/' + playListID + '/tracks';

  let data = "{\"uris\":[\"" + podcast_uri + "\"],\"position\":0}";

  let addplOptions = {
    'method': 'post',
    'contentType': 'application/json',
    'headers': {
      'Authorization': 'Bearer ' + token
    },
    'payload': data
  };

  // エピソード格納
  let response = UrlFetchApp.fetch(addplEndpoint, addplOptions);
  }
}
