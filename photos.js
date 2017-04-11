const VK = require('vksdk'),
  fs = require('fs'),
  https = require('https');

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
  console.log("ID отсутсвует. Заупстите ещё 'node photos.js id'");
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

// Turn on requests with access tokens
vk.setSecureRequests(true);

// First you have to pass access_token from client side JS code
vk.setToken(settings.access_token);

console.log('Определение группа или пользователь. Получаем id');
isUser();


function isUser() {
  vk.request('users.get', {
    'user_ids': screen_name
  }, function(_o) {
    if (_o.error) {
      if (_o.error.error_code == 113) {
        isGroup();
        return;
      } else {
        console.log(_o.error.error_msg);
        return;
      }
    } else {
      id = _o.response[0].id;
      start();
    }
  });
}

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
  // create user dir
  dir = 'photos/' + id;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  getAlbums();
}

function getPhotos(offset, count) {
  console.log("Получаю фото");

  vk.request('photos.getAll', {
    'owner_id': id,
    'extended': 0,
    'offset': offset,
    'count': count,
    'photo_sizes': 0,
    'no_service_albums': 1,
    'need_hidden': 0,
    'skip_hidden': 0
  }, function(_o) {
    if (!_o.response) return;
    if (_o.response.items.length == 0) return;

    console.log(_o.response.count);
    console.log(count);

    var total = _o.response.items.length + offset;

    console.log("Список фото получен. Получено " + total + " из " + _o.response.count);

    var items = _o.response.items;
    for (var i = 0; i < items.length; i++) {
      var item = items[i];

      var url = '';
      if (item.photo_2560) {
        url = item.photo_2560;
      } else if (item.photo_1280) {
        url = item.photo_1280;
      } else if (item.photo_807) {
        url = item.photo_807;
      } else if (item.photo_604) {
        url = item.photo_604;
      } else if (item.photo_130) {
        url = item.photo_130;
      } else if (item.photo_75) {
        url = item.photo_75;
      }

      photos.push({
        url: url,
        file: dir + '/' + item.album_id + '/' + url.substr(url.lastIndexOf('/') + 1)
      });

      //
    }

    if (_o.response.count > count+offset) {
      getPhotos(offset+count, count);
    } else {
      console.log("Начинаю скачивание");
      download(0);
    }
  });
}

function getAlbums() {
  console.log("Получаю альбомы");
  vk.request('photos.getAlbums', {
    'owner_id': id,
    'need_system': 0,
    'need_covers': 0,
    'photo_sizes': 0
  }, function(_o) {
    if (!_o.response) return;
    if (_o.response.items.length == 0) return;

    console.log("Альбомы получены");

    var items = _o.response.items;
    for (var i = 0; i < items.length; i++) {
      var item = items[i];

      albums[item.id] = item.title;

      if (!fs.existsSync(dir + '/' + item.id)) {
        fs.mkdirSync(dir + '/' + item.id);
      }
    }

    fs.writeFileSync(dir + '/' + 'albums.json', JSON.stringify(albums));


    getPhotos(0, 200);
  });
}

function download(i) {

  if (i >= photos.length) {
    console.log("Скачивание завершено");
    return;
  }
  downloader(photos[i].url, photos[i].file, i);
}
function downloader(url, f, i) {
  console.log(i + " Start " + url);
  var file = fs.createWriteStream(f);
  var request = https.get(url, function(response) {
    response.pipe(file);
    file.on('finish', function() {
      console.log(i + " Finish " + url);
      file.close(); // close() is async, call callback after close completes.
      download(i+1);
    });
    file.on('error', function(err) {
      console.log(i + " Error " + url);
      fs.unlink(dest); // Delete the file async. (But we don't check the result)
      console.log(err.message);
    });
  });
}
