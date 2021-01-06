const fs = require('fs');
const qrcode = require('qrcode');
const socket = require('socket.io');
const express = require('express');
const http = require('http');
const { Client } = require('whatsapp-web.js');

const app = express();
const server = http.createServer(app);
const io = socket(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Path where the session data will be stored
const SESSION_FILE_PATH = './session.json';

// Load the session data if it has been previously saved
let sessionData;
if(fs.existsSync(SESSION_FILE_PATH)) {
    sessionData = require(SESSION_FILE_PATH);
}

// Use the saved values
const client = new Client({
    session: sessionData
});

app.get('/', (req, res) => {
  res.sendFile('index.html', { root: __dirname });
});

client.on('message', msg => {
    if (msg.body == '!ping') {
        msg.reply('Helo Shofii :v ini kukirim dengan bot');
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
    socket.emit('message', 'Client is ready!');
    socket.emit('ready', 'Client is ready!');
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

app.post('/send-message', (req, res) => {
  const number = req.body.number;
  const message = req.body.message;

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

server.listen(8000, () => {
  console.log('App Running on port 8000');
});
