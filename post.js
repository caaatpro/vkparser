const VK = require('vksdk'),
  fs = require('fs'),
  https = require('https'),
  dateFormat = require('dateformat'),
  xlsx = require('node-xlsx').default,
  VKApi = require('node-vkapi');

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

if (process.argv <= 3) {
  console.log("ID отсутсвует. Заупстите ещё 'node wallget.js id_form id_to'");
  process.exit();
}

var screen_name_from = process.argv[2],
  screen_name_to = process.argv[3],
  id_from = 0,
  id_to = 0,
  dir = '',
  data = '',
  uploadServer,
  photos = [],
  photosData = [];

var vk = new VK({
  'appId': settings.appId,
  'appSecret': settings.appSecret,
  'version': '5.62'
});


// Turn on requests with access tokens
vk.setSecureRequests(true);

// First you have to pass access_token from client side JS code
vk.setToken(settings.access_token);

var VK2 = new VKApi({
  token: settings.access_token
});

console.log('Получаем id');
isGroup(screen_name_from, false);
isGroup(screen_name_to, true);


function isGroup(screen_name, to) {
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
      if (to) {
        id_to = -_o.response[0].id;
      } else {
        id_from = -_o.response[0].id;
      }

      if (id_from && id_to) {
        start();
      }
    }
  });
}

function start() {
  console.log(id_to);
  console.log(id_from);

  readData();
}

function post(i) {
  if (i >= data.length) {
    console.log("Все посты опубликованы");
    return;
  }

  /*
    data[i][6] - картинка
    data[i][5] - ссылка на пост
    data[i][4] - сылка на репост
    data[i][3] - репост
    data[i][2] - дата
    data[i][1] - текст
    data[i][0] - id
   */

  photos = [];
  photosData = [];
  if (data[i][6] != '') {
    var postPhotos = data[i][6].split(',');
    console.log(postPhotos.length);
    for (var j = 0; j < postPhotos.length; j++) {
      if (fs.existsSync(postPhotos[j])) {
        console.log(postPhotos[j]);
        photos.push(postPhotos[j]);
      }
    }
    uploadPhoto(0, i);
  } else {
    wallpost(i);
  }
}

function wallpost(i) {
  console.log(photosData);
  // post(i + 1);
  var attachments = '';

  if (photosData.length) {
    for (var k = 0; k < photosData.length; k++) {
      photosData[k].id

      if (attachments != '') {
        attachments += ',';
      }

      attachments += 'photo' + photosData[k].owner_id + '_' + photosData[k].id;
    }
  }

  vk.request('wall.post', {
    owner_id: id_to,
    from_group: 1,
    message: data[i][1],
    attachments: attachments
    //publish_date:
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
      console.log(_o);
      post(i+1);
    }
  });
}

function uploadPhoto(p, i) {
  if (p >= photos.length) {
    wallpost(i);
    return;
  }
  var total = p + 1;
  console.log("Загружаю фото поста " + total + " из " + photos.length);

  VK2.upload('photo_wall', {
      data: fs.createReadStream(photos[p])
    })
    .then(r => {
      photosData.push(r[0]);
      uploadPhoto(p + 1, i);
    })
    .catch(e => console.log(e));
}

function readData() {
  var file = screen_name_from + '.xlsx';

  if (!fs.existsSync(file)) {
    console.log("Файл " + screen_name_from + '.xlsx' + " не найден");
    return;
  }

  data = xlsx.parse(file)[0].data;

  post(1);
}
