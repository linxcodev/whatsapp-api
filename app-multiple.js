const fs = require('fs');
const http = require('http');
const qrcode = require('qrcode');
const express = require('express');
const socket = require('socket.io');
const { Client, MessageMedia } = require('whatsapp-web.js');
const { phoneNumberFormatter } = require('./Helpers/formatter');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = socket(server);
const port = process.env.PORT || 8000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.sendFile('index.html', { root: __dirname });
});

const sessions = [];
const createSession = (id, desc, io) => {
  // Path where the session data will be stored
  const SESSION_FILE_PATH = `./sessions/session-${id}.json`;

  // Load the session data if it has been previously saved
  let sessionData;
  if (fs.existsSync(SESSION_FILE_PATH)) {
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

  client.initialize();

  client.on('qr', (qr) => {
    // Generate and scan this code with your phone
    qrcode.toDataURL(qr, (err, url) => {
      io.emit('qr', { id: id, url: url });
      io.emit('message', { id: id, text: 'QR code diterima, silahkan scan...' });
    });
  });

  client.on('ready', () => {
    io.emit('ready', { id: id });
    io.emit('message', { id:id, text: 'Whatsapp API is ready!' });
  });

  // Save session values to the file upon successful auth
  client.on('authenticated', (session) => {
    io.emit('authenticated', { id: id });
    sessionData = session;
    fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
      if (err) {
        console.error(err);
      }
    });
  });

  // menambah client ke sessions
  sessions.push({
    id, description: desc, client
  })
}

io.on('connection', socket => {
  socket.on('create-session', data => {
    console.log('Create Session = ' + data.id);
    createSession(data.id, data.description, io)
  });
});

app.post('/send-message', (req, res) => {
  console.log('req', req.body.number);
  const sender = req.body.sender;
  const number = phoneNumberFormatter(req.body.number);
  const message = req.body.message;
  console.log('number', number);

  const client = sessions.find(session => session.id == sender).client;

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

server.listen(port, () => {
  console.log('App Running on port ' + port);
});
