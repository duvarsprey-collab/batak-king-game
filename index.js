const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

function desteOlustur() {
    const renkler = ['S', 'H', 'C', 'D']; 
    const degerler = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    let deste = [];
    for (let r of renkler) {
        for (let d of degerler) {
            deste.push({ renk: r, deger: d });
        }
    }
    return deste.sort(() => Math.random() - 0.5);
}

io.on('connection', (socket) => {
    console.log('Yeni oyuncu bağlandı.');

    socket.on('secim', (oyun) => {
        const yeniDeste = desteOlustur();
        const el = yeniDeste.slice(0, 13);
        // ÖNEMLİ: Sadece seçimi yapan oyuncuya kart gönderiyoruz
        socket.emit('oyunBasladi', { oyun: oyun, kartlar: el });
    });

    socket.on('kartAt', (kart) => {
        io.emit('kartAtildi', { id: socket.id, kart: kart });
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('Sistem 3000 portunda aktif!'));