const VK = require('vksdk'),
  fs = require('fs'),
  https = require('https'),
  sqlite3 = require('sqlite3').verbose(),


  db = new sqlite3.Database('wall.db');

var settings = {
  appId: 5931573,
  appSecret: '0F4bg8Y96gkiBHkOLRZT',
  scope: 'wall,offline,photos',
  access_token: 'b37e182591481d31a786186133293058b44b98dfa3a0d501abe1d5f0cfafa3cfdaef03670632a5cf8ed42'
};

var lastRequest = 0;

if (settings.access_token == '') {
  console.log('Ссылка получения access_token: https://oauth.vk.com/authorize?client_id=' + settings.appId + '&display=page&redirect_uri=https://oauth.vk.com/blank.html&scope=' + settings.scope + '&response_type=token&expires_in=0&v=5.62');
  process.exit();
}

if (process.argv <= 2) {
  console.log("ID отсутсвует. Заупстите ещё 'node wallget.js id'");
  process.exit();
}

var screen_name = process.argv[2],
  id = 0,
  albums = {},
  photos = [],
  dir = '';

var vk = new VK({
  'appId': settings.appId,
  'appSecret': settings.appSecret,
  'version': '5.62'
});

console.log(screen_name);


// Turn on requests with access tokens
vk.setSecureRequests(true);

// First you have to pass access_token from client side JS code
vk.setToken(settings.access_token);

console.log('Получаем id');
isGroup()

function isGroup() {
  vk.request('groups.getById', {
    'group_ids': screen_name
  }, function(_o) {
    if (_o.error) {
      if (_o.error.error_code == 100) {
        console.log("Не верный идентификатор");
        process.exit();
      } else {
        console.log(_o.error.error_msg);
        return;
      }
    } else {
      id = -_o.response[0].id;
      start();
    }
  });
}

function start() {
  console.log(id);

  // create user dir
  dir = 'wallphotos/' + id;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  getPosts(0, 100);
}


function getPosts(offset, count) {
  console.log("Получаю посты");

  vk.request('wall.get', {
    'owner_id': id,
    'offset': offset,
    'count': count
  }, function(_o) {
    if (!_o.response) return;
    if (_o.response.items.length == 0) return;

    console.log(_o.response.count);
    console.log(count);

    var total = _o.response.items.length + offset;

    console.log("Получено " + total + " из " + _o.response.count);

    var items = _o.response.items;
    for (var i = 0; i < items.length; i++) {
      var item = items[i],
        postID,
        text,
        data,
        repost,
        link,
        images;

      text = item.text;

      if (item.attachments) {
        var attachments = item.attachments;
        for (var j = 0; j < attachments.length; j++) {
          if (attachments[j].type == 'link') {
            text += '\n' + attachments[j].link.url;
          }
        }
      }

      console.log(text);

      if (item.copy_history) {
        for (var k = 0; k < item.copy_history.length; k++) {
          text += '\n' + item.copy_history[k].text;

          if (item.copy_history[k].attachments) {
            var attachments = item.copy_history[k].attachments;

            for (var l = 0; l < attachments.length; l++) {
              if (attachments[l].type == 'link') {
                text += '\n' + attachments[l].link.url;
              }
            }
          }
        }
      }

      // console.log(item);
    }

    if (_o.response.count > count + offset) {
      getPhotos(offset + count, count);
    } else {
      console.log("Все посты получены");
    }
  });
}

function saveToDb(postID, text, data, repost, link, images) {
  db.get('SELECT id FROM posts WHERE postID = ' + postID, function(err, row) {
    if (err) {
      console.log(err);
      reject();
      return;
    }

    if (row == undefined) {
      db.run("INSERT INTO posts (postID, text, data, repost, link, images) VALUES (?, ?, ?, ?, ?, ?)", postID, text, data, repost, link, images, function(err, row) {
        if (err) {
          console.log(err);
          reject();
          return;
        }

        return;
      });
    } else {
      return;
    }
  });
}
