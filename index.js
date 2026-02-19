const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

let rooms = {};

function createDeck() {
    const suits = ['S', 'H', 'C', 'D']; // Maça, Kupa, Sinek, Karo
    const values = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    let deck = [];
    suits.forEach(s => values.forEach(v => deck.push({ suit: s, value: v, rank: values.indexOf(v) })));
    return deck.sort(() => Math.random() - 0.5);
}

io.on('connection', (socket) => {
    socket.on('joinGame', (mode) => {
        let deck = createDeck();
        let cards = deck.slice(0, 13).sort((a, b) => b.rank - a.rank);
        socket.emit('initGame', { cards, mode });
        
        // Bot Modu ise diğer 3 oyuncuyu simüle et
        if (mode === 'bot') {
            console.log("Botlarla oyun başladı.");
        }
    });

    socket.on('playCard', (data) => {
        // [Çıkarım] Burada kart yükseltme ve kural kontrolü yapılır
        io.emit('cardPlayed', { id: socket.id, card: data.card });
        
        if (data.mode === 'bot') {
            // Basit Bot Hamlesi: 1 saniye sonra rastgele botlar kart atar
            setTimeout(() => {
                const colors = ['S', 'H', 'C', 'D'];
                const botCard = { suit: colors[Math.floor(Math.random()*4)], value: 'J', rank: 9 };
                io.emit('cardPlayed', { id: 'bot', card: botCard });
            }, 1000);
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('Sunucu 3000 portunda hazır!'));