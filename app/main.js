//const electron = require('electron');
//const BrowserWindow = electron.BrowserWindow;
var os = require('os');

// run gc every 10 second.
var tick = 0;
if (global.gc) {
  setInterval(function () {
    if (process.memoryUsage().rss > 1024 * 1024 * 200) { //200MB
      global.gc();
      console.log(`[${tick}] global.gc() executed - ${process.memoryUsage().rss}`);
    }
    else console.log(`[${tick}] gc tick - ${process.memoryUsage().rss}`);
    tick++
  }, 10000);
}

var cnt = 0;

// do not open the window and open it in external browser
/*
nw.Window.get().on('new-win-policy', function (frame, url, policy) {
  policy.ignore();
  nw.Shell.openExternal(url);
});
*/

// string formatting
if (!String.prototype.format) {
  String.prototype.format = function () {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function (match, number) {
      return typeof args[number] != 'undefined' ? args[number] : match;
    });
  };
  String.prototype.string = function (len) {
    var s = '', i = 0;
    while (i++ < len) {
      s += this;
    }
    return s;
  };

  String.prototype.zf = function (len) {
    return '0'.string(len - this.length) + this;
  };
  Number.prototype.zf = function (len) {
    return this.toString().zf(len);
  };
}

// date formatting
Date.prototype.format = function (f) {
  if (!this.valueOf()) return ' ';

  var weekName = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  var d = this;

  return f.replace(/(yyyy|yy|MM|dd|E|hh|mm|ss|a\/p)/gi, function ($1) {
    switch ($1) {
      case 'yyyy': return d.getFullYear();
      case 'yy': return (d.getFullYear() % 1000);
      case 'MM': return (d.getMonth() + 1);
      case 'dd': return d.getDate();
      case 'E': return weekName[d.getDay()];
      case 'HH': return d.getHours().zf(2);
      case 'hh': return ((h = d.getHours() % 12) ? h : 12).zf(2);
      case 'mm': return d.getMinutes().zf(2);
      case 'ss': return d.getSeconds().zf(2);
      case 'a/p': return d.getHours() < 12 ? '오전' : '오후';
      default: return $1;
    }
  });
};

var htl_scr01, htl_scr02;
var ntl_scr01, ntl_scr02;
var dtl_scr01, dtl_scr02;

var Twitter = require('twitter');
var Twitter_text = require('twitter-text');
var Util = require('util');
var OAuth = new (require('oauth').OAuth)(
  'https://api.twitter.com/oauth/request_token',
  'https://api.twitter.com/oauth/access_token',
  '',
  '',
  '1.0',
  null, // callback URL
  'HMAC-SHA1'
);

var symbol = require('../app/symbols');

var Client = new Twitter({
  consumer_key: '',
  consumer_secret: '',
  access_token_key: '',
  access_token_secret: ''
});

var Stream;

var App = {
  // Kuritsu Consumer Key
  _DefaultConsumerKey: 'hFFszQ5tet93VbnD9m153Tudc',
  _DefaultConsumerSecret: 'Aub7LIPgREDs6AhzYmvEriXDugNThlxVOx2dMS0JUPfH1zgeLf',
  config: require('./default/def_conf.json'),

  // current configuration used by twitter
  // https://dev.twitter.com/rest/reference/get/help/configuration
  twitter_conf: require('./default/def_twtconf.json'),

  id_str: '',
  name: '',
  screen_name: '',
  tweet_count: 0,

  tweetUploader: new TweetUploader(),

  styleSheet: document.createElement('style'),

  timelines: {
    home_timeline: [],
    notification: []
  },

  setBackground (config) {
    var html = document.documentElement;
    if (config.defaultBackground == 'true') {
      html.style.background = `url('arisaka_mashiro.png') center no-repeat fixed`;
      return;
    }
    html.style.backgroundImage = `url('${config.bgImage.replace(/\\/g, '\\\\')}')`;
    html.style.backgroundColor = config.bgColor;
    html.style.backgroundPosition = config.bgPosition;
    html.style.backgroundSize = config.bgSize;
    html.style.backgroundRepeat = config.bgRepeat;
  },

  confirmAuth: msg => {
    if (!msg) var msg = 'oauth 토큰이 유효하지 않습니다. 지금 토큰을 요청할까요?\r\n' +
                        '토큰을 요청하지 않으면 기능이 작동하지 않습니다.';
    var result = confirm(msg);
    if (result) App.getRequestToken(App.getConsumerKey(), App.getConsumerSecret());
  },

  confirmAuthFirst: () => {
    var msg = '발급받은 oauth 토큰이 없습니다. 지금 토큰을 요청할까요?\r\n' +
               '토큰을 요청하지 않으면 기능이 작동하지 않습니다.';
    return App.confirmAuth(msg);
  },

  promptPin: () => {
    var pin;
    pin = prompt('토큰 요청후 발급받은 핀번호를 입력하세요');

    if (pin != null)
      App.getAccessToken(pin);
  },

  getConsumerKey: () => {
    if (!App.config.ConsumerKey)
      return App._DefaultConsumerKey;
    else return App.config.ConsumerKey;
  },

  getConsumerSecret: () => {
    if (!App.config.ConsumerSecret)
      return App._DefaultConsumerSecret;
    else return App.config.ConsumerSecret;
  },

  getRequestToken: (consumerKey, consumerSecret) => {
    if (!consumerKey) consumerKey = App.getConsumerKey();
    if (!consumerSecret) consumerSecret = App.getConsumerSecret();
    OAuth._consumerKey = consumerKey;
    OAuth._consumerSecret = consumerSecret;
    OAuth.getOAuthRequestToken((error, oauth_token, oauth_token_secret, results) => {
      if (error)
        console.error(error);
      else {
        console.log('oauth_token :' + oauth_token);
        console.log('oauth_token_secret :' + oauth_token_secret);
        console.log('requestoken results :' + Util.inspect(results));
        console.log('Requesting access token');

        OAuth._requestToken = oauth_token;

        //console.warn('https://twitter.com/oauth/authenticate?oauth_token=' + oauth_token + "\n");

        openExternal('https://twitter.com/oauth/authenticate?oauth_token=' + oauth_token);
        App.promptPin();
      }
    });
  },

  getAccessToken: pin => {
    if (!pin) {
      alert('핀번호를 입력해 주십시오.');
      return getAccessToken();
    }
    OAuth.getOAuthAccessToken(OAuth._requestToken, OAuth._consumerSecret, pin,
      (err, access_token, access_secret, results) => {
        if (err) {
          switch (err.data) {
            case 'Error processing your OAuth request: Invalid oauth_verifier parameter':
              alert('핀번호가 올바르지 않습니다.');
              getAccessToken();
              break;

            case 'Invalid request token.':
              alert('만료된 인증 토큰입니다. 인증을 다시 요청하세요.');
              break;

            default:
              alert('인증이 실패했습니다. 잠시 후 다시 시도해 주십시오.\r\n' + err.data);
              break;
          }
          return;
        }

        alert('인증이 성공했습니다.');

        App.config.ConsumerKey = OAuth._consumerKey;
        App.config.ConsumerSecret = OAuth._consumerSecret;
        App.config.AccessToken = access_token;
        App.config.AccessSecret = access_secret;

        //OAuth.getProtectedResource("https://api.twitter.com/1/statuses/home_timeline.json", "GET", oauth_access_token, oauth_access_token_secret, function (error, data, response) {
        //    Util.puts(data);
        //});

        ipcRenderer.send('save-config', config);
        App.initializeClient(OAuth._consumerKey, OAuth._consumerSecret, access_token, access_secret);
        App.run();
      });

  },

  initializeClient: (consumer_key, consumer_secret, access_token_key, access_token_secret) => {
    Client.options.consumer_key = consumer_key;
    Client.options.consumer_secret = consumer_secret;
    Client.options.access_token_key = access_token_key;
    Client.options.access_token_secret = access_token_secret;

    Client.options.request_options.oauth.consumer_key = consumer_key;
    Client.options.request_options.oauth.consumer_secret = consumer_secret;
    Client.options.request_options.oauth.token = access_token_key;
    Client.options.request_options.oauth.token_secret = access_token_secret;
  },

  vertifyCredentials: (callback) => {
    Client.get('account/verify_credentials', (error, event, response) => {
      if (error) {
        // retry vertifyCredentials if limit
        if (error.code == 'ENOTFOUND') {
          App.showMsgBox('인터넷 또는 서버가 불안정합니다. 자동으로 서버에 접속을 시도합니다', 'tomato', 3000);
          return setTimeout(() => App.vertifyCredentials(callback), 1000);
        } else if (error[0].code == 88) {
          App.showMsgBox('API 리밋으로 연결이 지연되고 있습니다. 잠시만 기다려 주세요', 'tomato', 12000);
          return setTimeout(() => App.vertifyCredentials(callback), 10000);
        } else {
          App.showMsgBox('알 수 없는 문제로 연결이 지연되고 있습니다. 잠시만 기다려 주세요', 'tomato', 12000);
          return setTimeout(() => App.vertifyCredentials(callback), 10000);
        }
      } else {
        App.clearMsgBox();
        App.id_str = event.id_str;
        App.name = event.name;
        App.screen_name = event.screen_name;
      }

      if (callback)
        callback(error);
    });
  },

  getLimitStatus: () => {
    Client.get('application/rate_limit_status', (error, event, response) => {
      if (error) {
        console.error(error);
      } else {
        console.log(event);
      }
    });
  },

  chkConnect: () => {
    var timestamp = new Date().getTime();
    Client.get('https://api.twitter.com/1/', (error, event, response) => {
      if (App.chkConnect.event_timestamp > timestamp) return;
      App.chkConnect.event_timestamp = timestamp;

      if (App.config.runStream && !Client.mainStreamRunning && !App.chkConnect.iserror) {
        App.chkConnect.iserror = true;
        App.alertConnect(false);
      } else if (error.code) {
        if (!App.chkConnect.iserror) {
          App.chkConnect.iserror = true;
          App.alertConnect(false);

          if (App.config.runStream)
            App.stopMainStream();
        }
      } else {
        if (App.chkConnect.iserror) {
          App.chkConnect.iserror = false;
          App.alertConnect(true);

          if (App.config.runStream)
            App.runMainStream();
        }
      }
    });

    setTimeout(App.chkConnect, 5000);
  },

  runMainStream: () => {
    if (Client.mainStream)
      Client.mainStream.destroy();

    App.alertConnect(true);

    Client.stream('user', { }, (stream) => {
      Client.mainStream = stream;
      Client.mainStreamRunning = true;
      App.alertStream(true);
      App.alertConnect(true);
      App.chkConnect();
      stream.on('data', (tweet) => {
        if (tweet.text) {
          // 자기 자신의 리트윗은 스트리밍에서 막음
          if (App.config.hideMyRetweets && tweet.retweeted_status && tweet.user.id_str == App.id_str)
            return;

          App.addItem(home_timeline, new Tweet(tweet));
          if (App.config.enableHomeTLNoti) App.showNotify(tweet);
          if (App.config.enableHomeTLSound) document.getElementById('update-sound').play();

          //console.log(App.calcItemHeight(new Tweet(tweet)));

          // debug flag
          if (App.config.debug)
            console.log(tweet);

          // 리트윗된 트윗이 아닐때 멘션되었으면 멘션창으로 이동시킴
          var copy_mention = false;
          if (!tweet.retweeted_status)
            for (var name of Twitter_text.extractMentions(tweet.text))
              if (name == App.screen_name) copy_mention = true;
          if (copy_mention) {
            App.addItem(notification, new Tweet(tweet));
            if (!App.config.enableHomeTLNoti && App.config.enableMentionTLNoti) App.showNotify(tweet);
            if (!App.config.enableHomeTLSound && App.config.enableMentionTLSound) document.getElementById('update-sound').play();
          }

          // 리트윗시 원문이 노티로 가게
          if (tweet.retweeted_status)
            tweet = tweet.retweeted_status;

          App.runMainStream.sequence = (App.runMainStream.sequence + 1) % 3;

          // alert noti
          /*
          if(App.config.enableHomeTLNoti)
          {
          }
          */
        } else if (tweet.delete) {
          var target = document.querySelector(`[data-tweet-id="${tweet.delete.status.id_str}"]`);
          if (target)
            target.classList.add('deleted');
        } else if (tweet.event == 'retweeted_retweet' || tweet.event == 'favorited_retweet') {
          App.addItem(notification, new Tweet(tweet.target_object, false, tweet.event, tweet.source));
          console.log(tweet);
        } else {
          console.log(tweet);
        }
      });
      stream.on('error', error => console.error(error));
      stream.on('end', response => {
        console.warn(response);
        Client.mainStream = '';
        Client.mainStreamRunning = false;
      });
    });
  },

  stopMainStream: () => {
    Client.mainStreamRunning = false;
    Client.mainStream.destroy();
  },

  alertStream: e => {
    stream_off.style = (e ? 'display: none' : '');
    App.resizeContainer();
  },

  alertConnect: e => {
    conn_error.style = (e ? 'display: none' : '');
    App.resizeContainer();
  },

  chkRetweet: (id, check, count) => {
    for (var tl in App.timelines) {
      for (var t of App.timelines[tl].filter(x => (x.id == id || (x.hasRetweet && x.retweet.id == id)))) {
        var lbl = t.retweetCountLabel;
        if (typeof count != 'undefined' && typeof count != 'string')
          if (count)
            lbl.innerText = count;
          else
            lbl.innerText = '';
        if (check) {
          t.isRetweeted = true;
          t.element.classList.add('retweeted');
          if (count == 'auto')
            lbl.innerText++;
        } else {
          t.isRetweeted = false;
          t.element.classList.remove('retweeted');
          if (count == 'auto')
            lbl.innerText = lbl.innerText == '1' ? '' : lbl.innerText - 1;
        }
      }
    }
  },

  chkFavorite: (id, check, count) => {
    for (var tl in App.timelines) {
      for (var t of App.timelines[tl].filter(x => (x.id == id || (x.hasRetweet && x.retweet.id == id)))) {
        var lbl = t.favoriteCountLabel;
        if (typeof count != 'undefined' && typeof count != 'string')
          if (count)
            lbl.innerText = count;
          else
            lbl.innerText = '';
        if (check) {
          t.isFavorited = true;
          t.element.classList.add('favorited');
          if (count == 'auto')
            lbl.innerText++;
        } else {
          t.isFavorited = false;
          t.element.classList.remove('favorited');
          if (count == 'auto')
            lbl.innerText = lbl.innerText == '1' ? '' : lbl.innerText - 1;
        }
      }
    }
  },

  showMsgBox: (a, b, c) => {
    /* 2-argument:
     *   a: message, b: duration (default color is blue)
     * 3-argument:
     *   a: message, b: color, c: duration (in msec) */
    if (!c) {
      c = b;
      b = 'blue';
    }

    msgbox.innerHTML = a;
    msgbox.className = 'msgbox ' + b;
    msgbox.setAttribute('timestamp', new Date().getTime());
    App.resizeContainer();

    if (c) {
      var timestamp = msgbox.getAttribute('timestamp');
      setTimeout(id => {
        if (msgbox.getAttribute('timestamp') == timestamp)
          App.clearMsgBox();
      }, c);
    }
  },

  clearMsgBox: () => {
    msgbox.classList.add('hidden');
    App.resizeContainer();
  },

  resizeContainer: () => {
    container.style.height = 'calc(100% - ' + toolbox.getClientRects()[0].height + 'px)';
    App.procOffscreen(App.currTimeline());
  },

  openSettings () {
    ipcRenderer.send('open-setting');
  },
/*
  var t = [home_timeline];
  for (tl of t)
  {
    home_timeline.addEventListener("scroll", () => {
      App.procScrollEmphasize(home_timeline);

      // offscreen process
      App.procOffscreen();

      // magic scroll 100px padding
      if(App.config.magicScroll)
      {
        if(home_timeline.scrollTop < 100)
        home_timeline.style.paddingTop = home_timeline.scrollTop + 'px';
      }
      else
      {
        home_timeline.style.paddingTop = '0px';
      }
    });
  }
  */
  procOffscreen: (tlContainer) => {
    if (tlContainer && tlContainer.firstElementChild) {
      Array.from(tlContainer.firstElementChild.children).forEach((item) => {
        if (isOffscreen(tlContainer, item)) {
          if (item.firstElementChild.style.display != 'none') {
            item.style.height = (item.firstElementChild.getClientRects()[0].height + 10) + 'px';
            item.firstElementChild.style.display = 'none';
            Array.from(item.getElementsByTagName('video')).forEach(i => {
              i.pause();
              i.setAttribute('src', '');
              i.load(); // dispose
            });
          }
        } else {
          if (item.firstElementChild.style.display == 'none') {
            item.style.height = '';
            item.firstElementChild.style.display = 'block';
            Array.from(item.getElementsByTagName('video')).forEach(i => {
              i.removeAttribute('src');
              i.load();
            });
          }
        }
      });
    }
  },
  currTimeline: () => {
    return container.children[Number(container.style.left.replace('vw', '')) / -100];
  },

  procScrollEmphasize:e => {
    if (!e.scrollTop)
      e.classList.add('scrolltop');
    else
      e.classList.remove('scrolltop');
  },

  getTimeline: () => {
    Client.get('https://api.twitter.com/1.1/statuses/home_timeline', {since_id: App.getTimeline.since_id || ''}, (error, event, response) => {
      if (!error) for (var item of event.reverse()) {
        App.addItem(home_timeline, new Tweet(item));
        App.getTimeline.since_id = item.id_str;
      }
      else console.error(error);
    });
  },

  getTweetItem: e => {
    Client.get(`https://api.twitter.com/1.1/statuses/show/${e}`, {}, (error, event, response) => {
      if (!error) {
        if (App.config.debug) console.log(event);
        App.addItem(home_timeline, new Tweet(event));
      } else {
        console.error(error);
      }
    });
  },

  getMentionsTimeline: () => {
    Client.get('statuses/mentions_timeline', {since_id: App.getMentionsTimeline.since_id || ''}, (error, event, response) => {
      if (!error) {
        for (var item of event.reverse()) {
          App.addItem(notification, new Tweet(item));
          App.getMentionsTimeline.since_id = item.id_str;
        }
      } else {
        console.log(event);
      }
    });
  },

  getAboutme: () => {
    Client.get('https://api.twitter.com/i/activity/about_me', {cards_platform:'Web-12', include_cards:'1', model_version:'7', count: 600, since_id:App.getAboutme.max_position}, (error, event, response) => {
      if (!error) {
        if (event.length) {
          App.getAboutme.max_position = event[0].max_position;
        }
        for (var i = event.length - 1; i >= 0; i--) {
          addActivity(notification, event[i]);

          // debug flag
          if (App.config.debug)
            console.log(event[i]);
        }
      } else {
        console.warn(error);
      }
      //setTimeout(getAboutme, 3000);
    });
  },
  showNotify: (tweet) => {
    // Notification 요청
    if (!('Notification' in window)) {

    } else if (Notification.permission === 'granted') {
      Notification.requestPermission();

      var noti = new Notification(tweet.user.name,
        {tag: App.showNotify.sequence, body: tweet.text, icon: tweet.user.profile_image_url_https});

      // 노티를 클릭하면 창 닫기
      noti.onclick = () => noti.close();

      // 노티 타임아웃 처리
      noti.onshow = () => setTimeout(() => noti.close(), 3000);
    }
  },
  addItem: (tlContainer, tweet) => {
    var tl = tlContainer.firstElementChild;

    App.timelines[tlContainer.id].push(tweet);

    // 200개가 넘어가면 가장 오래된 10개를 지운다.
    if (tl.childElementCount > 200)
      App.removeItems(tlContainer, 10);

    // 유저가 스크롤바를 잡고 있을때는 추가되는 트윗을 감춤.
    // onmouseup 이벤트 발생시 트윗들을 다시 꺼냄
    if (window.scrolling) {
      document.getElementById('new_tweet_noti').hidden = false;
      tweet.element.classList.add('hidden');
    }
    console.log(`cnt: ${cnt++}`);
    tl.insertBefore(tweet.element, tl.firstElementChild);

    if (!window.scrolling) {
      // scrollbar 이동
      if (tlContainer.scrollTop) {
        tlContainer.scrollTop += tl.firstElementChild.getClientRects()[0].height + 10;
      }
    }
    tweet = '';

    App.procOffscreen(tlContainer);
  },
  removeItem: (t, target) => {
    if (typeof target == 'number')
      target = document.querySelector(`[data-item-id="${target}"]`);
    t.firstElementChild.removeChild(target);
  },
  removeItems: (timeline, count) => {
    var removed = App.timelines[timeline.id].splice(0, count);
    for (var t of removed) {
      discardElement(t.element);
      //t.element.remove();
    }
  },
  calcItemHeight: e => {
    if (!document.getElementById('calcItem')) {
      var elemDiv = document.createElement('div');
      elemDiv.style.cssText = 'position: absolute; visibility: hidden';
      elemDiv.innerHTML = '';
      elemDiv.id = 'calcItem';
      document.body.insertBefore(elemDiv, document.body.firstChild);
    }
    //document.createElement("div")
    calcItem.innerHTML = e.element.outerHTML;
    var result = calcItem.getClientRects()[0].height;
    calcItem.innerHTML = '';
    return result;
  },

  initializeStyle (config) {
    App.setBackground(config);
    App.styleSheet.innerHTML = `
      .tweet {
        background-color: rgba(255,255,255,${config.tweetOpacity / 100.0});
      }
    `;
    document.body.appendChild(App.styleSheet);
  },

  run () {
    var config = App.config = ipcRenderer.sendSync('load-config');
    App.initializeClient(config.ConsumerKey, config.ConsumerSecret, config.AccessToken, config.AccessSecret);
    App.initializeStyle(config);

    if (!config.AccessToken || !config.AccessSecret) {
      oauth_req.style.display = '';
      App.resizeContainer();
      return App.confirmAuthFirst();
    }

    App.vertifyCredentials(error => {
      if (error) {
        oauth_req.style.display = '';
        App.resizeContainer();

        return App.confirmAuth();
      } else {
        oauth_req.style.display = 'none';
        App.resizeContainer();
        App.getTimeline();
        //App.getTweetItem('751494319601754112');
        App.getMentionsTimeline();
        if (config.runStream)
          App.runMainStream();
        else
          App.alertStream(false);
        //getAboutme();
      }
    });
  },
};

ipcRenderer.on('reload-config', (event, arg) => {
  console.info('reload!');
  App.initializeStyle(arg);
});

// Static variable
App.chkConnect.iserror = false;
App.chkConnect.event_timestamp = 0;
App.getTimeline.since_id = '1';
App.getMentionsTimeline.since_id = '1';
App.getAboutme.max_position = 0;
App.showNotify.sequence = 0;

function Test (event) {
  var a = document.createElement('article');
  a.className = 'tweet';
  //a.setAttribute('data-tweet-id', tweet.id_str);
  //a.setAttribute('data-tweet-timestamp', tweet.timestamp_ms);
  var div = document.createElement('div');
  div.innerHTML = 'TESTTEST';
  a.appendChild(div);
  this.element = a;
}

function Activity (event) {
  var a = document.createElement('article');
  a.className = 'tweet';
  a.innerHTML = '';
  var div = document.createElement('div');
  var tweet_div = 'action: {0}, sources.0.name: {1}';
  div.innerHTML += tweet_div.format(event.action, event.sources[0].name);
           //<!--<input type="button" value="-" onclick="removeRow(this.parentNode)">//-->
  this.element = a;
}

function tag (strings, ...values) {
  for (s in strings) {
    console.log(s);
  }
}

function Tweet (tweet, quoted, event, source) {
  var tweet = tweet;
  var quoted = quoted;
  var a = document.createElement('article');
  var className = quoted ? 'tweet quoted' : 'tweet';

  this.id = tweet.id_str;
  this.timestamp = new Date(Date.parse(tweet.created_at)).getTime();
  this.isFavorited = tweet.favorited;
  this.favoriteCount = tweet.favorite_count;
  this.isRetweeted = tweet.retweeted;
  this.retweetCount = tweet.retweet_count;
  this.hasRetweet = tweet.retweeted_status ? true : false;
  if (this.hasRetweet)
    this.retweet = {
      id: tweet.retweeted_status.id_str,
      timestamp: new Date(Date.parse(tweet.retweeted_status.created_at)).getTime(),
      isFavorited: tweet.retweeted_status.favorited,
      favoriteCount: tweet.retweeted_status.favorite_count,
      isRetweeted: tweet.retweeted_status.retweeted,
      retweetCount: tweet.retweeted_status.retweet_count
    };

  a.className = 'tweet_wrapper';

  a.setAttribute('data-tweet-id', tweet.id_str);
  a.setAttribute('data-tweet-timestamp', tweet.timestamp_ms);

  var mentioned_me = false;
  if (!tweet.retweeted_status)
    for (var name of Twitter_text.extractMentions(tweet.text))
      if (name == App.screen_name) mentioned_me = true;
  if (mentioned_me) className += ' tweet_emp blue';

  // retweeted / favorited
  var retweeted = '';
  var favorited = '';
  if (tweet.favorited)
    favorited = 'favorited';
  if (tweet.retweeted || tweet.retweeted_status && tweet.user.id_str == App.id_str)
    retweeted = 'retweeted';

  var id_str_org = tweet.id_str;

  var div = document.createElement('div');
  div.className = className;

  if (event == 'retweeted_retweet') {
    div.innerHTML += `<div class="retweeted_retweeted_tweet">&nbsp;&nbsp;${symbol.retweet}
            <a href="javascript:void(0)" onclick="openPopup('https://twitter.com/${source.screen_name}')">${source.name}</a> 님이 내가 리트윗한 트윗을 리트윗했습니다.</span>`;
    if (tweet.retweeted_status) tweet = tweet.retweeted_status;
  }
  if (event == 'favorited_retweet') {
    div.innerHTML += `<div class="favorited_retweeted_tweet">&nbsp;&nbsp;${symbol.like}
            <a href="javascript:void(0)" onclick="openPopup('https://twitter.com/${source.screen_name}')">${source.name}</a> 님이 내 리트윗을 마음에 들어 합니다.</span>`;
    if (tweet.retweeted_status) tweet = tweet.retweeted_status;
  } else if (tweet.retweeted_status) {
    div.innerHTML += `<div class="retweeted_tweet">${symbol.retweet}<span class="retweeted_tweet_text">&nbsp;
            <a href="javascript:void(0)" onclick="openPopup('https://twitter.com/${tweet.user.screen_name}')">${tweet.user.name}</a> 님이 리트윗했습니다</span></div>`;
    tweet = tweet.retweeted_status;
  } else if (tweet.in_reply_to_status_id_str !== null && !quoted) {
    // 자신의 트윗에 답글 단 경우 즉, 이어쓰기 트윗
    if (tweet.user.screen_name === tweet.in_reply_to_screen_name) {
      var replied_to = tweet.user.name;
    } else {
      var user_mentions = tweet.entities.user_mentions;
      var replied_to = user_mentions[0].name;
    }
    div.innerHTML += `<div class="replied_tweet">${symbol.reply}<span class="replied_tweet_text">&nbsp;
      <a href="javascript:void(0)" onclick="openPopup('https://twitter.com/${tweet.in_reply_to_screen_name}')">${replied_to}</a> 님에게 답글을 보냈습니다</span></div>`;
  }

  var embed = {
    id_str: tweet.id_str,
    user_name: tweet.user.name,
    user_screen_name: tweet.user.screen_name,
    text: tweet.text
  };
  a.setAttribute('data-json', JSON.stringify(embed));

  // 텍스트에 링크걸기
  var text_obj = [];
  var entity = [tweet.entities.hashtags, tweet.entities.urls, tweet.entities.user_mentions, (tweet.entities.media ? tweet.entities.media : '')];
  for (ent of entity)
    for (item of ent)
      text_obj.push(item);
  text = Twitter_text.autoLink(tweet.text, {urlEntities: text_obj});

  // 팝업 창에서 링크가 열리게끔 수정
  text = text.replace(/(<a[^>]*) href="([^"]*)"/g, '$1 href="javascript:void(0)" onclick="openPopup(\'$2\')"');

  // @(아이디) 꼴 골뱅이에도 링크가 붙도록 변경
  text = text.replace(/@(<a[^>]* class="tweet-url username" [^>]*>)/g, '$1@');

  // 공백을 <br>로 치환
  text = text.replace(/(\r\n|\n|\r)/gm, '<br>');

  // 이모지 파싱
  text = twemoji.parse(text);

  // 프로텍트 이미지
  var tweet_protected = '';
  if (tweet.user.protected) tweet_protected = symbol.protected;

  div.innerHTML += `<img class="profile-image" src="${tweet.user.profile_image_url_https}"></img>
          <div class="tweet-name"><a href="javascript:void(0)" onclick="openPopup('https://twitter.com/${tweet.user.screen_name}')">
          <strong>${tweet.user.name}</strong>
          <span class="tweet-id">@${tweet.user.screen_name}</span></a><span class="user_protected">${tweet_protected}</div></div>
          <p class="tweet-text lpad">${text}</p>`;

  var entities = tweet.extended_entities || tweet.entities || null;
  if (entities.media) {
    var container = document.createElement('div');

    if (entities.media[0].type == 'animated_gif' || entities.media[0].type == 'video') {
      var muted = (entities.media[0].type == 'video') ? 'muted' : '';
      var loop = (entities.media[0].type == 'animated_gif') ? 'loop' : '';
      var type = (entities.media[0].type == 'animated_gif') ? 'tweet-gif' : 'tweet-video';
      container.className = 'tweet-media-container';
      container.innerHTML += `<div class="${type}"><video id="my-video" class="video-js" ${loop} ${muted} autoplay controls preload="auto" poster="${entities.media[0].media_url_https}" data-setup="{}"></video></div>`;

      for (i in entities.media[0].video_info.variants)
        container.getElementsByTagName('video')[0].innerHTML += `<source src="${entities.media[0].video_info.variants[i].url}" type='${entities.media[0].video_info.variants[i].content_type}'>`;

      div.appendChild(container);
    } else {
      var urls = entities.media.map((x) => x.media_url_https);
      var urlstr = urls.join(';');
      container.setAttribute('data-media-count', entities.media.length);
      container.className = 'tweet-media-container';
      for (var i in urls)
        container.innerHTML += `<div class="tweet-image"><a href="javascript:void(0)" onclick="openImageview('${urls[i]}', '${urlstr}')"><img src="${urls[i]}"/></a></div>`;
      div.appendChild(container);
    }
  }

  var quoted_status = tweet.quoted_status || null;
  if (!quoted && quoted_status) {
    var twt = new Tweet(quoted_status, true);
    div.appendChild(twt.element);
  }

  div.innerHTML += `<div class="tweet-date lpad">
          <a href="javascript:void(0)" onclick="openPopup('https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}')">
          ${new Date(Date.parse(tweet.created_at)).format('a/p hh:mm - yyyy년 MM월 dd일')}
          </a> · ${tagRemove(tweet.source)}</div>`;
  if (!tweet.retweet_count)
    tweet.retweet_count = '';
  if (!tweet.favorite_count)
    tweet.favorite_count = '';

  if (!quoted) {
    var _e = document.createElement('div');
    _e.innerHTML += `<div aria-label="트윗 작업" role="group" class="tweet-task lpad">
            <div class="tweet-task-box"><button aria-label="답글" class="reply" type="button"">
            <span>${symbol.reply}</span></button></div><div class="tweet-task-box ${retweeted}"><button aria-label="리트윗" class="retweet" type="button">
            <span class="tweet-task-count">${symbol.retweet}&nbsp;<span><span class="retweet-count">${tweet.retweet_count}</span></span></span></button>
            </div><div class="tweet-task-box ${favorited}"><button aria-label="마음에 들어요" class="like" type="button"><span>${symbol.like}&nbsp;
            <span class="tweet-task-count"><span class="favorite-count">${tweet.favorite_count}</span></span></span></button></div></div>`;
    this.retweetCountLabel = _e.getElementsByClassName('retweet-count')[0];
    this.favoriteCountLabel = _e.getElementsByClassName('favorite-count')[0];
    var replyButton = _e.getElementsByClassName('reply')[0],
      retweetButton = _e.getElementsByClassName('retweet')[0],
      likeButton = _e.getElementsByClassName('like')[0];
    replyButton.addEventListener('click', evt => tryReply(), false);
    retweetButton.addEventListener('click', evt => execRetweet(), false);
    likeButton.addEventListener('click', evt => execFavorite(), false);
    div.appendChild(_e.firstElementChild);
  }

  a.appendChild(div);
  this.element = a;

  var tryReply = () => {
    App.tweetUploader.openPanel();
    var usernames = [],
      tweet_author = tweet.user.screen_name;
    if (tweet_author != App.screen_name) usernames.push(tweet_author);
    for (var name of Twitter_text.extractMentions(tweet.text))
      if (name != tweet_author && name != App.screen_name)
        usernames.push(name);

    App.tweetUploader.text = usernames.map(x => '@' + x).join(' ');
    if (App.tweetUploader.text) App.tweetUploader.text += ' ';
    App.tweetUploader.inReplyTo = {id: tweet.id_str, name: tweet.user.name, screen_name: tweet_author, text: tweet.text};
    App.resizeContainer();
  };

  var execRetweet = () => {
    if (!this.isRetweeted) {
      App.showMsgBox('리트윗했습니다', 'blue', 1000);
      App.chkRetweet(tweet.id_str, true, 'auto');
      Client.post(`statuses/retweet/${tweet.id_str}`, (error, tweet, response) => {
        if (error) {
          console.warn(error);
          switch (error[0].code) {
            // already retweeted
            case 327:
              App.showMsgBox('이미 리트윗한 트윗입니다', 'tomato', 1000);
              return;
            // rate limit reached
            case 88:
              App.showMessageBox('API 리밋입니다', 'tomato', 1000);
              return;
            default:
              App.showMsgBox(`오류가 발생했습니다<br>${error[0].code}: ${error[0].message}`, 'tomato', 5000);
          }
          App.chkRetweet(tweet.id_str, false, 'auto');
        }
      });
    } else {
      App.showMsgBox('언리트윗했습니다', 'blue', 1000);
      App.chkRetweet(tweet.id_str, false, 'auto');

      Client.post('statuses/unretweet/' + tweet.id_str, (error, tweet, response) => {
        if (error) {
          console.warn(error);
          App.chkRetweet(tweet.id_str, true, 'auto');
        }
      });
    }
    document.activeElement.blur();
  };

  var execFavorite = () => {
    App.showMsgBox('마음에 드는 트윗으로 지정했습니다', 'blue', 1000);
    if (!this.isFavorited) {
      App.chkFavorite(tweet.id_str, true, 'auto');
      Client.post('favorites/create', {id: tweet.id_str}, (error, tweet, response) => {
        if (error) {
          console.warn(error);
          switch (error[0].code) {
            // already favorited
            case 139:
              App.showMsgBox('이미 마음에 드는 트윗으로 지정한 트윗입니다', 'tomato', 1000);
              return;
            // rate limit reached
            case 88:
              App.showMessageBox('API 리밋입니다', 'tomato', 1000);
              return;
            default:
              App.showMsgBox(`오류가 발생했습니다<br />${error[0].code}: ${error[0].message}`, 'tomato', 5000);
          }
          App.chkFavorite(tweet.id_str, false, 'auto');
        }
      });
    } else {
      App.showMsgBox('마음에 드는 트윗을 해제했습니다', 'blue', 1000);
      App.chkFavorite(tweet.id_str, false, 'auto');

      Client.post('favorites/destroy', {id: tweet.id_str}, (error, tweet, response) => {
        if (error) {
          console.warn(error);
          // no status found
          if (error[0].code == 144)
            return;
          App.chkFavorite(tweet.id_str, true, 'auto');
        }
      });
    }
    document.activeElement.blur();
  };
}

function TweetUploader () {
  this.mediaSelector = new MediaSelector();

  var _isOpen = false;
  var _inReplyTo = '';
  var e = document.createElement('div'),
    replyInfo = document.createElement('div'),
    txt = document.createElement('textarea'),
    btnContainer = document.createElement('div'),
    closeButton = document.createElement('div'),
    lenIndicator = document.createElement('span'),
    postButton = document.createElement('input');

  /*initElement*/ {
    e.className = 'writebox';
    e.hidden = true;
    replyInfo.className = 'reply-info';
    txt.rows = 4;
    btnContainer.className = 'buttons';
    postButton.className = 'bluebutton';
    postButton.type = 'button';
    postButton.value = '트윗하기';

    closeButton.appendChild((() => {
      var a = document.createElement('a');
      a.href = 'javascript:void(0)';
      a.innerHTML = symbol.close;
      a.addEventListener('click', e => this.closePanel());
      return a;
    })());
    btnContainer.appendChild(closeButton);
    btnContainer.appendChild(this.mediaSelector.element);
    btnContainer.appendChild((() => {
      var div = document.createElement('div');
      div.appendChild(lenIndicator);
      div.appendChild(postButton);
      return div;
    })());
    e.appendChild(replyInfo);
    e.appendChild(txt);
    e.appendChild(btnContainer);

    var txtChanged = e => (lenIndicator.innerHTML = 140 - (App.tweetUploader.mediaSelector.selectedFiles.length ? App.twitter_conf.characters_reserved_per_media : 0) - Twitter_text.getTweetLength(txt.value));
    txt.addEventListener('input', txtChanged);
    txt.addEventListener('keydown', e => {
      switch (e.keyCode) {
        case 16: break;
        case KEY.ENTER:
          if (!e.shiftKey) execTweet();
          break;
        case KEY.ESC:
          this.closePanel();
          return false;
      }
    }, false);
    postButton.addEventListener('click', e => execTweet());
  }

  var execTweet = () => {
    var text = txt.value;
    this.closePanel();

    if (this.mediaSelector.selectedFiles.length != 0) {
      var path = this.mediaSelector.selectedFiles;
      var files = [];
      App.showMsgBox('트윗을 올리는 중입니다', 'orange', 30000);
      for (var i in path)
        (index => {
          var data = require('fs').readFileSync(path[index]);
          Client.post('media/upload', {media: data}, (error, media, response) => {
            if (!error) {
              console.log(media);
              files[index] = media;
              // 임시폴더에 있는 파일은 지운다.
              if (path[index].indexOf(os.tmpdir()) === 0) {
                fs.unlink(path[index], () => {});
              }
              // make sure all fies are successfully uploaded.
              if (files.filter(f => f !== undefined).length === path.length) {
                return _ex(files.map(x => x.media_id_string).join(','));
              }
            } else {
              return App.showMsgBox(`오류가 발생했습니다<br />${error[0].code}: ${error[0].message}`, 'tomato', 5000);
            }
          });
        })(i);
    } else {
      return _ex();
    }

    function _ex (media_ids) {
      var param = {status: text};
      if (media_ids) param.media_ids = media_ids;

      if (_inReplyTo != '') param.in_reply_to_status_id = _inReplyTo;

      Client.post('statuses/update', param, (error, event, response) => {
        if (!error) {
          App.showMsgBox('트윗했습니다', 'blue', 3000);
        } else {
          App.showMsgBox(`오류가 발생했습니다<br />${error[0].code}: ${error[0].message}`, 'tomato', 5000);
        }
      });
    }
  };

  this.element = e;

  this.openPanel = () => {
    _isOpen = true;
    this.inReplyTo = '';
    this.mediaSelector.reset();
    replyInfo.hidden = true;
    e.hidden = false;
    lenIndicator.innerHTML = '140';
    txt.value = '';
    txt.focus();
    App.resizeContainer();
  };

  this.closePanel = () => {
    _isOpen = false;
    e.hidden = true;
    App.resizeContainer();
  };

  this.focus = () => txt.focus();

  Object.defineProperties(this, {
    isOpen: {
      get: () => _isOpen
    },
    text: {
      get: () => txt.value,
      set: (val) => {
        txt.value = val;
        lenIndicator.innerHTML = 140 - (App.tweetUploader.mediaSelector.selectedFiles.length ? App.twitter_conf.characters_reserved_per_media : 0) - Twitter_text.getTweetLength(txt.value);
      }
    },
    inReplyTo: {
      get: () => _inReplyTo,
      set: (obj) => {
        _inReplyTo = obj.id;
        replyInfo.hidden = false;
        replyInfo.innerHTML = `<div class="name">${obj.name} 님에게 보내는 답글</div><div class="orig-text">@${obj.screen_name}: ${obj.text}</div>`;
      }
    }
  });
}

function MediaSelector () {
  var e = document.createElement('div'),
    thumbContainer = document.createElement('div'),
    fileInputContainer = document.createElement('div'),
    fileInput = document.createElement('input');

  e.className = 'media-uploader';
  thumbContainer.className = 'thumbnails';
  thumbContainer.style.fontSize = '0';
  fileInputContainer.className = 'bluebutton';
  fileInputContainer.setAttribute('style', 'position:relative;overflow:hidden;');
  fileInput.type = 'file';
  fileInput.accept = '.png,.jpg,.gif,.mp4';
  fileInput.setAttribute('style', 'position:absolute;top:0;left:0;font-size:999px;opacity:0;');

  fileInputContainer.innerHTML += '<span>파일 추가</span>';
  fileInputContainer.appendChild(fileInput);
  e.appendChild(thumbContainer);
  e.appendChild(fileInputContainer);

  fileInput.onchange = e => {
    this.addFile(fileInput.value);
  };

  this.element = e;
  this.selectedFiles = [];

  this.addFile = path => {
    if (this.selectedFiles.length == 4) {
      App.showMsgBox('이미지는 4개까지 첨부할 수 있습니다.', 'tomato', 3000);
      return;
    }
    if (this.selectedFiles.indexOf(path) != -1) {
      App.showMsgBox('같은 파일을 중복으로 선택할 수 없습니다.', 'tomato', 3000);
      return;
    }
    if (this.selectedFiles.length == 0)
      App.showMsgBox('썸네일을 클릭하면 이미지를 삭제할 수 있습니다.', 'blue', 3000);
    thumbContainer.appendChild((() => {
      var e = document.createElement('div');
      e.className = 'thumbnail';
      e.setAttribute('data-media', path);
      e.style.backgroundImage = `url('${path.replace(/\\/g, '/')}')`;
      e.addEventListener('click', (e) => {
        var path = e.target.getAttribute('data-media'),
          idx = this.selectedFiles.indexOf(path);
        this.selectedFiles.splice(idx, 1);
        e.target.outerHTML = '';
        fileInput.disabled = false;
        fileInputContainer.classList.remove('disabled');
        lenIndicator.innerHTML = 140 - (App.tweetUploader.mediaSelector.selectedFiles.length ? App.twitter_conf.characters_reserved_per_media : 0) - Twitter_text.getTweetLength(txt.value);
        console.log(this.selectedFiles);
      });
      return e;
    })());
    this.selectedFiles.push(path);
    lenIndicator.innerHTML = 140 - (App.tweetUploader.mediaSelector.selectedFiles.length ? App.twitter_conf.characters_reserved_per_media : 0) - Twitter_text.getTweetLength(txt.value);

    fileInput.value = '';
    if (this.selectedFiles.length == 4) {
      fileInput.disabled = true;
      fileInputContainer.classList.add('disabled');
    }
  };

  this.reset = () => {
    fileInput.value = '';
    fileInput.disabled = false;
    fileInputContainer.classList.remove('disabled');
    thumbContainer.innerHTML = '';
    this.selectedFiles = [];
  };
}

// enter full screen, scrollTop reset to zero issue
// https://bugs.chromium.org/p/chromium/issues/detail?id=142427
document.addEventListener('webkitfullscreenchange', () => {
  if (document.webkitIsFullScreen !== null) {
    // reset to original scroll pos
    if (!htl_scr01 && !home_timeline.scrollTop)
      home_timeline.scrollTop = htl_scr02;
    if (!ntl_scr01 && !notification.scrollTop)
      notification.scrollTop = ntl_scr02;
  }
}, false);

var garbageBin;
window.onload = e => {
  App.document = document;

  // create a 'garbage bin' object
  if (typeof garbageBin === 'undefined') {
    garbageBin = document.createElement('div');
    garbageBin.style.display = 'none';
    document.body.appendChild(garbageBin);
  }

  // scrollbar hack
  home_timeline.onmousedown = () => {
    window.scrolling = true;
  };
  home_timeline.firstElementChild.onmousedown = f => {
    window.scrolling = false;
    f.stopPropagation();
  };
  home_timeline.onmouseup = e => {
    var that = e.currentTarget;
    window.scrolling = false;
    for (var i = 1; i < that.firstElementChild.childNodes.length - 1; i++) {
      if (that.firstElementChild.childNodes[i].className != undefined &&
      that.firstElementChild.childNodes[i].classList.contains('hidden')) {
        new_tweet_noti.hidden = true;
        that.firstElementChild.childNodes[i].classList.remove('hidden');
        if (that.scrollTop)
          that.scrollTop += that.firstElementChild.childNodes[i].getClientRects()[0].height + 10;

      }
    }
  };

  function offScreen (tlContainer) {
    App.procScrollEmphasize(tlContainer);

    // offscreen process
    App.procOffscreen(tlContainer);

    // magic scroll 100px padding
    if (App.config.magicScroll &&
    (tlContainer.offsetHeight < tlContainer.getElementsByClassName('timeline')[0].offsetHeight)) {// is overflow
      if (tlContainer.scrollTop < 100) {
        tlContainer.style.paddingTop = tlContainer.scrollTop + 'px';
      }
    } else {
      tlContainer.style.paddingTop = '0px';
    }
  }

  // full screen scroll init issue fix
  home_timeline.onscroll = () => {
    htl_scr02 = htl_scr01;
    htl_scr01 = home_timeline.scrollTop;

    offScreen(home_timeline);
  };

  notification.onscroll = () => {
    // full screen scroll init issue fix
    ntl_scr02 = ntl_scr01;
    ntl_scr01 = notification.scrollTop;

    offScreen(notification);
  };


  window.onresize = () => App.procOffscreen(App.currTimeline());

  window.magicScroll = false;
  var magicScrollHandler = e => {
    if (!App.config.magicScroll)
      return;

    var tl = e.currentTarget,
      dy = e.deltaY;

    if (magicScroll && dy > 0) {
      return false;
    } else if (tl.scrollTop == 0 && dy > 0 &&
    (tl.offsetHeight < tl.getElementsByClassName('timeline')[0].offsetHeight)) { // is overflow
      magicScroll = true;
      setTimeout(() => {
        window.magicScroll = false;
      }, App.config.magicScrollSensitivity);
      tl.style.paddingTop = `${dy}px`;
      tl.scrollTop = dy;
      return false;
    } else if (dy < 0 && tl.style.paddingTop != '0px') {
      tl.scrollTop += dy;
      tl.style.paddingTop = 0;
    }
  };
  home_timeline.onwheel = magicScrollHandler;
  notification.onwheel = magicScrollHandler;

  App.document.body.addEventListener('paste', function (event) {
    /* 작동설명:
     * 트윗덱 붙여넣기 스크립트와 달리, 파일을 직접 입력받지 않는 대신
     * 파일의 경로를 받고 이를 읽어서 업로드를 한다.
     * 따라서, 쿠레하는
     * 1. 클립보드에서 이미지를 읽음
     * 2. 이미지를 임시파일에 씀 (util.js createTempFile 함수)
     * 3. 2번과정에서 쓴 파일을 갖고 mediaSelector.addFile 메서드 호출
     * 4. 업로드하고 나면 임시파일 삭제
     */
    var fileToUpload;
    try {
      let clipdata = event.clipboardData;
      let items = clipdata.items;
      let item = items[0];
      if (item.kind === 'file') {
        fileToUpload = item.getAsFile();
      }
    } catch (e) {
      return;
    }
    if (!fileToUpload) return;
    let upload = (path) => {
      let uploader = App.tweetUploader;
      if (!uploader.isOpen) {
        uploader.openPanel();
      }
      let mediaSelector = uploader.mediaSelector;
      mediaSelector.addFile(path);
    };
    let reader = new FileReader();
    reader.onload = () => {
      let rawdata = reader.result;
      createTempFile(rawdata, (err, path) => {
        if (err) {
          alert('업로드에 실패했습니다!');
          return;
        }
        upload(path);
      });
    };
    reader.readAsBinaryString(fileToUpload);
  });

  header_navi.innerHTML += `<span class="navigator selected" onclick="naviSelect(0)"><a href="javascript:void(0)">${symbol.home}</a></div>`;
  header_navi.innerHTML += `<span class="navigator" onclick="naviSelect(1)"><a href="javascript:void(0)">${symbol.noti}</a></div>`;
  header_navi.innerHTML += `<span class="navigator" onclick="naviSelect(2)"><a href="javascript:void(0)">${symbol.dm}</a></div>`;
  header_navi.innerHTML += `<span class="navigator" onclick="naviSelect(3)"><a href="javascript:void(0)">${symbol.search}</a></div>`;
  header_navi.innerHTML += `<span class="navigator" onclick="naviSelect(4)"><a href="javascript:void(0)">${symbol.write}</a></div>`;
  header_navi.innerHTML += '<div id="page_indicator"></div>';
  header_setting.innerHTML = `<a href="javascript:void(0)" onclick="App.openSettings()">${symbol.settings}</a>`;

  toolbox.appendChild(App.tweetUploader.element);

  //chooseFile('#fileDialog');
  // run Application
  App.run();
};

function discardElement (element) {
  //Move the element to the garbage bin element
  garbageBin.appendChild(element);
  //Empty the garbage bin
  garbageBin.innerHTML = '';
}

var KEY = {
  NUMBER_1:   49,
  NUMBER_2:   50,
  NUMBER_3:   51,
  N:          78,
  ENTER:      13,
  ESC:        27,
  WASD_LEFT:  65,
  WASD_RIGHT: 68,
  WASD_UP:    87,
  WASD_DOWN:  83
};

document.onkeydown = e => {
  var isShift;
  if (window.event) {
    key = window.event.keyCode;
    isShift = !!window.event.shiftKey;
  } else {
    key = e.which;
    isShift = !!e.shiftKey;
  }

  if (document.activeElement.type != 'textarea') {
    switch (e.keyCode) {
      case KEY.NUMBER_1:
        naviSelect(0);
        break;
      case KEY.NUMBER_2:
        naviSelect(1);
        break;
      case KEY.NUMBER_3:
        naviSelect(2);
        break;
      case KEY.N:
        if (!App.tweetUploader.isOpen)
          naviSelect(4);
        else App.tweetUploader.focus();
        return false;

      /*
      case KEY.WASD_LEFT:
        alert('Left');
        break;
      case KEY.WASD_RIGHT:
        alert('Right');
        break;
      case KEY.WASD_UP:
        alert('Up');
        break;
      case KEY.WASD_DOWN:
        alert('Down');
        break;
  */
      default:
        return; // exit this handler for other keys
    }
  }
};
function scrollTo (element, to, duration) {
  if (duration <= 0) return;
  var difference = to - element.scrollTop;
  var perTick = difference / duration * 10;

  setTimeout(() => {
    element.scrollTop = element.scrollTop + perTick;
    if (element.scrollTop === to) return;
    scrollTo(element, to, duration - 10);
    App.procOffscreen(App.currTimeline());
  }, 10);
}
function naviSelect (e) {
  if (e > 2 || header_navi.children[e].classList.contains('selected')) {
    switch (e) {
      case 0:
        home_timeline.style.paddingTop = '0';
        scrollTo(home_timeline, 0, 200);
        document.activeElement.blur();
        break;
      case 1:
        scrollTo(notification, 0, 200);
        document.activeElement.blur();
        break;
      case 2:
        scrollTo(direct_message, 0, 200);
        document.activeElement.blur();
        break;
      case 4:
        var uploader = App.tweetUploader;
        if (uploader.isOpen)
          uploader.closePanel();
        else
          uploader.openPanel();
        break;
    }
  } else {
    switch (e) {
      case 0:
        header_text.innerHTML = '홈 타임라인';
        break;
      case 1:
        header_text.innerHTML = '알림';
        break;
      case 2:
        header_text.innerHTML = '쪽지';
        break;
    }
    for (var i = 0; i < container.childElementCount; i++)
      header_navi.children[i].classList.remove('selected');
    header_navi.children[e].classList.add('selected');

    page_indicator.style.left = (e * 20) + '%';
    container.style.left = (e * (-100)) + 'vw';
    App.procOffscreen(App.currTimeline());
  }
}
function chooseFile (name) {
  var chooser = document.querySelector(name);
  chooser.addEventListener('change', evt => console.log(this.value), false);

  chooser.click();
}
