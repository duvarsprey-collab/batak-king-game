const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('Bir oyuncu bağlandı kanka!');
    // Oyun seçim mesajı
    socket.on('secim', (oyun) => {
        console.log('Seçilen oyun: ' + oyun);
        io.emit('oyunBasladi', oyun);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log('Sunucu ' + PORT + ' portunda canavar gibi çalışıyor!');
});