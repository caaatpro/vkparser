const VK = require('vksdk'),
  fs = require('fs'),
  https = require('https'),
  dateFormat = require('dateformat'),
  xlsx = require('node-xlsx').defaultж

var settings = {
  appId: ид,
  appSecret: 'секретный ключ',
  scope: 'wall,offline,photos',
  access_token: ''
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
isGroup();

var data = [
  ['ID', "Текст", "Дата", "Репост", "Сылка на репост", "Сылка на пост", "Картинки" ]
];

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
        date,
        repost = false,
        link,
        repostLinks = '',
        images = [];

      text = item.text;
      postID = item.id;

      link = "https://vk.com/" + screen_name + "?w=wall" + id + "_" + postID;

      date = dateFormat(new Date(item.date * 1000), 'dd.mm.yyyy HH:MM');

      if (item.attachments) {
        var attachments = item.attachments;
        for (var j = 0; j < attachments.length; j++) {
          if (attachments[j].type == 'link') {
            text += '\n' + attachments[j].link.url;
          } else if (attachments[j].type == 'photo') {
            images.push(getPhotoUrl(attachments[j].photo, postID));
          }
        }
      }

      if (item.copy_history) {
        repost = true;
        for (var k = 0; k < item.copy_history.length; k++) {
          var ll = "https://vk.com/public" + Math.abs(item.copy_history[k].owner_id) + "?w=wall" + item.copy_history[k].owner_id + "_" + item.copy_history[k].id;

          if (repostLinks != '') {
            repostLinks += ',' + ll;
          } else {
            repostLinks = ll;
          }

          text += '\n' + item.copy_history[k].text;

          if (item.copy_history[k].attachments) {
            var attachments = item.copy_history[k].attachments;

            for (var l = 0; l < attachments.length; l++) {
              if (attachments[l].type == 'link') {
                text += '\n' + attachments[l].link.url;
              } else if (attachments[l].type == 'photo') {
                images.push(getPhotoUrl(attachments[l].photo, postID));
              }
            }
          }
        }
      }
      console.log(repostLinks);
      // console.log(images);
      console.log(item);

      var dirAttachments = dir + '/' + postID;
      if (!fs.existsSync(dirAttachments)) {
        fs.mkdirSync(dirAttachments);
      }

      // console.log(item);

      data.push([
        postID,
        text,
        date,
        repost ? "Нет" : 'Да',
        link,
        repostLinks,
        images.join(',')
      ]);
    }

    if (_o.response.count > count + offset) {
      getPosts(offset + count, count);
    } else {
      console.log("Все посты получены");
      download(0);
    }
  });
}

function saveData() {
  console.log("Сохраняю данные");

  var buffer = xlsx.build([{name: "wall", data: data}]); // Returns a buffer
  fs.open(screen_name+'.xlsx', 'w', function(err, fd) {
      if (err) {
          throw 'error opening file: ' + err;
      }

      fs.write(fd, buffer, 0, buffer.length, null, function(err) {
          if (err) throw 'error writing file: ' + err;
          fs.close(fd, function() {
              console.log('Данные сохранены');
          })
      });
  });
}

function getPhotoUrl(photo, postid) {
  var url = '';
  if (photo.photo_2560) {
    url = photo.photo_2560;
  } else if (photo.photo_1280) {
    url = photo.photo_1280;
  } else if (photo.photo_807) {
    url = photo.photo_807;
  } else if (photo.photo_604) {
    url = photo.photo_604;
  } else if (photo.photo_130) {
    url = photo.photo_130;
  } else if (photo.photo_75) {
    url = photo.photo_75;
  }

  var file = dir + '/' + postid + '/' + url.substr(url.lastIndexOf('/') + 1);

  photos.push({
    url: url,
    file: file
  });

  return file;
}


function download(i) {

  if (i >= photos.length) {
    console.log("Скачивание завершено");
    saveData();
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
      download(i + 1);
    });
    file.on('error', function(err) {
      console.log(i + " Error " + url);
      fs.unlink(dest); // Delete the file async. (But we don't check the result)
      console.log(err.message);
    });
  });
}
