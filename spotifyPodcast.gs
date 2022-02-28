// spotifyの情報入力 
const SPOTIFY_CLIENT_ID = 'Deveropersから取得したCLIENT_ID';
const SPOTIFY_CLIENT_SECRET = 'Deveropersから取得したCLIENT_SECRET';

// ID類が書かれているスプレッドシートを取得
const ID_spreadSheet = SpreadsheetApp.openById('スプレッドシートのID'); // ★()内変更お願いします。
// ID類が書かれているシートを取得
const ID_sheet = ID_spreadSheet.getSheetByName('ID'); // ★「ID」というシートがある前提での記述になっております。適宜変更してください。

// 定期実行トリガーを作成（第2,4金曜18時）
// ★毎月1日18時前に実行するように指定
function createTrigger() {
  // 今日の日付から月初を取得
  const date = new Date(); // 今日現在
  const day = 5;　// 金曜日
  const weeks = [2, 4]; // 第2,4週
  let specifiedDay = '';
  const days = getDays(date, day);
  const specifiedDays = days.filter((v, i) => weeks.includes(i+1));
  for (i = 0; i < specifiedDays.length; i++) {
    specifiedDay = specifiedDays[i];
    specifiedDay.setHours(18);
    specifiedDay.setMinutes(00);
    ScriptApp.newTrigger('timeTriggerFunction')
      .timeBased()
      .at(specifiedDay)
      .create();
  }
}


/*
*その年月のd曜日を取得する関数
* 
* @param {Date} date - 調べたい年月の日付（Date型）
* @param {number} day - 取得したい曜日を表す数値(0:日曜日〜6:土曜日)
* @return {days} ある年月のday曜日の日付の入った配列
*/

function getDays(date, day) {
  const year = date.getFullYear();
  const month = date.getMonth();

  const days = [];

  for (let i = 1; i <= 31; i++){
    const tmpDate = new Date(year, month, i);

    if (month !== tmpDate.getMonth()) break; //月代わりで処理終了
    if (tmpDate.getDay() !== day) continue; //引数に指定した曜日以外の時は何もしない
    days.push(tmpDate);
  }

  return days;
}

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
  .setScope('playlist-modify-private' 'user-read-currently-playing');
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

// 定期実行用
function timeTriggerFunction() {
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
  let rss_playlistID = rss_array[1];
  getPodcast(accessToken, rss_title, rss_playlistID);
  return displayStr;
  
};

// RSSからタイトルとカテゴリを抽出する処理
function get_rss() {

  // フィードURL
  let my_rss = ID_sheet.getRange(2,2).getValue(); // ★B2に格納している値を取得。適宜変更してください。
  
  // カテゴリ配列
  let category_table = ID_sheet.getRange(4,1,ID_sheet.getLastRow() - 3,2).getValues();
  let category_array = [];
  let keys = ['category_str', 'ID'];
  let category_List = [];

  // IDシートからカテゴリ名を抜き出して配列にする処理と、カテゴリ名とIDをJSON形式にする処理
  category_table.forEach((v,i,a) => {
    category_array.push(v[0]); 
  });

  //繰り返し処理にて実装します。
  for(var j = 1; j < category_table.length; j++) {
    var values = category_table[j];
    var hash = {}
    for(var k = 0; k < values.length; k++) {
      var key = keys[k];
      var value = values[k];
      hash[key] = value;
    }
    category_List.push(hash);
  }

  let category = '';
  let playlistID_array = '';
  let playlistID = '';

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
        // category_index = category_table.indexOf(category);
        if(category != null) {
          category = category_text;
          // ここにcategory_List内でカテゴリが変数categoryに一致するIDを取り出す処理を書く
          playlistID_array = category_List.find( ({ category_str }) => category_str === category);
          playlistID = playlistID_array['ID'];
          break;
          }else{
            if (i === 3) {
              throw new Error('Required');
            }
          }
      }
    return [title, playlistID];
}


function getPodcast(token, title, playlistID) {

// プレイリストを取得

// SBCastプレイリストのID
let SBCast_ID = ID_sheet.getRange(3,2).getValue();

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


// プレイリストに指定エピソードを格納

  // カテゴリによって格納するプレイリストを変更する
  let addplEndpoint = '';

  addplEndpoint = 'https://api.spotify.com/v1/playlists/' + playlistID + '/tracks';

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