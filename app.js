const fs = require('fs');
const http = require('http');
const qrcode = require('qrcode');
const express = require('express');
const socket = require('socket.io');
const { Client, MessageMedia } = require('whatsapp-web.js');
const { body, validationResult } = require('express-validator');
const { phoneNumberFormatter } = require('./Helpers/formatter');
const fileUpload = require('express-fileupload');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = socket(server);
const port = process.env.PORT || 8000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
  debug: true
}));

// Path where the session data will be stored
const SESSION_FILE_PATH = './session.json';

// Load the session data if it has been previously saved
let sessionData;
if(fs.existsSync(SESSION_FILE_PATH)) {
    sessionData = require(SESSION_FILE_PATH);
}

// Use the saved values
const client = new Client({
  restartOnAuthFail: true,
  puppeteer: {
    headless: true,
    args: [ // configure make hemat ram
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process', // <- this one doesn't works in Windows
      '--disable-gpu'
    ],
  },
  session: sessionData
});

app.get('/', (req, res) => {
  res.sendFile('index.html', { root: __dirname });
});

client.on('message', msg => {
    if (msg.body == '!ping') {
        msg.reply('!pong');
    }
});

client.initialize();

// socket io
io.on('connection', socket => {
  socket.emit('message', 'Connecting...');

  client.on('qr', (qr) => {
      // Generate and scan this code with your phone
      qrcode.toDataURL(qr, (err, url) => {
        socket.emit('qr', url);
        socket.emit('message', 'QR code diterima silahkan scan...');
      });
  });

  client.on('ready', () => {
    socket.emit('message', 'Whatsapp API is ready!');
    socket.emit('ready', 'Whatsapp API is ready!');
    console.log('Whatsapp API is ready!');
  });

  // Save session values to the file upon successful auth
  client.on('authenticated', (session) => {
    socket.emit('authenticated', 'Client is Authenticated');
    sessionData = session;
    fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
        if (err) {
            console.error(err);
        }
    });
  });
});

const checkRegisteredNumber = async function(number) {
    const isRegistered = await client.isRegisteredUser(number);
    return isRegistered;
}

app.post('/send-message', [
    body('number').notEmpty(),
    body('message').notEmpty()
], async (req, res) => {
    const errors = validationResult(req).formatWith(({msg}) => {
        return msg;
    });

    if (!errors.isEmpty()) {
      return res.status(422).json({
        status: false,
        response: errors.mapped()
      });
    }

    const number = phoneNumberFormatter(req.body.number);
    const message = req.body.message;

    // check register or no
    const isRegisteredNumber = await checkRegisteredNumber(number);
     if (!isRegisteredNumber) {
       return res.status(422).json({
         status: false,
         response: 'The number is not registered'
       });
     }

    client.sendMessage(number, message).then(response => {
        res.status(200).json({
           status: true,
           response: response
        });
    }).catch(err => {
        res.status(500).json({
           status: false,
           response: err
        });
    });
});

app.post('/send-media', async (req, res) => {
    const number = phoneNumberFormatter(req.body.number);
    const caption = req.body.caption;

    // 1.static file
    // const media = MessageMedia.fromFilePath('./img.jpg');
    // 2.upload file
    // const file = req.files.file;
    // const media = new MessageMedia(file.mimetype, file.data.toString('base64'), file.name)
    // 3.axios
    const fileUrl = req.body.file;
    let mimetype;
    const attch = await axios.get(fileUrl, {responseType: 'arraybuffer'}).then(res => {
      mimetype = res.headers['content-type'];
      return res.data.toString('base64');
    });
    const media = new MessageMedia(mimetype, attch, 'Media')

    client.sendMessage(number, media, { caption: caption }).then(response => {
        res.status(200).json({
           status: true,
           response: response
        });
    }).catch(err => {
        res.status(500).json({
           status: false,
           response: err
        });
    });
});

server.listen(port, () => {
  console.log('App Running on port ' + port);
});
