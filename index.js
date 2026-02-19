const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

// --- OYUN AYARLARI ---
const SUITS = ['S', 'H', 'C', 'D']; 
const VALUES = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

let gameState = {
    players: [], 
    deck: [],
    table: [],
    turnIndex: 0,
    gameMode: null,
    trumpSuit: null,
    kingContract: null,
    scores: {},
    phase: 'lobby'
};

function createDeck() {
    let deck = [];
    SUITS.forEach(s => VALUES.forEach(v => {
        deck.push({ suit: s, value: v, rank: VALUES.indexOf(v), id: s+v });
    }));
    return deck.sort(() => Math.random() - 0.5);
}

// BOT HAMLESİ: En mantıklı kartı seçer
function getBotMove(player) {
    // 1. Eğer yer boşsa: Rastgele (veya büyük) at
    if (gameState.table.length === 0) {
        return player.hand[Math.floor(Math.random() * player.hand.length)];
    }

    const leadSuit = gameState.table[0].card.suit;
    const cardsOfSuit = player.hand.filter(c => c.suit === leadSuit);

    // 2. Yerdeki renkten varsa: Mecburen onu at
    if (cardsOfSuit.length > 0) {
        // Basit Zeka: Rastgele birini seç (Geliştirilebilir: En büyüğü at)
        return cardsOfSuit[Math.floor(Math.random() * cardsOfSuit.length)];
    }

    // 3. Renk yoksa: Koz var mı? (Batak ise)
    if (gameState.trumpSuit) {
        const trumps = player.hand.filter(c => c.suit === gameState.trumpSuit);
        if (trumps.length > 0) return trumps[0];
    }

    // 4. Hiçbiri yoksa: En küçük kartı at (Salla gitsin)
    return player.hand[0];
}

// ORTAK KART ATMA FONKSİYONU (Hem Sen Hem Bot İçin)
function handlePlayCard(playerId, card) {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return;

    // Kartı elden çıkar
    player.hand = player.hand.filter(c => c.id !== card.id);
    
    // Gerçek oyuncuysa elini güncelle
    if (!player.isBot) {
        io.to(playerId).emit('yourHand', player.hand);
    }

    // Masaya koy
    gameState.table.push({ playerId: playerId, card: card });
    io.emit('tableUpdate', gameState.table);

    // Sırayı ilerlet
    gameState.turnIndex = (gameState.turnIndex + 1) % 4;
    const nextPlayer = gameState.players[gameState.turnIndex];
    io.emit('turnChange', nextPlayer.id);

    // El bitti mi?
    if (gameState.table.length === 4) {
        setTimeout(finishTrick, 1500);
    } else {
        // Sıradaki oyuncu Botsa, hamle yaptır
        if (nextPlayer.isBot) {
            setTimeout(() => {
                const botCard = getBotMove(nextPlayer);
                handlePlayCard(nextPlayer.id, botCard);
            }, 1000); // 1 saniye düşünme payı
        }
    }
}

function finishTrick() {
    // Kazananı belirle (Basit Mantık: En büyük atan)
    let winner = gameState.table[0];
    const leadSuit = winner.card.suit;

    gameState.table.forEach(move => {
        if (move.card.suit === leadSuit && move.card.rank > winner.card.rank) {
            winner = move;
        }
        // Koz kontrolü buraya eklenebilir
    });

    // Puan ver
    gameState.scores[winner.playerId] = (gameState.scores[winner.playerId] || 0) + 1;
    io.emit('updateScores', gameState.scores);
    
    // Masayı temizle
    gameState.table = [];
    io.emit('tableUpdate', []);
    
    // Kazanan başlar
    gameState.turnIndex = gameState.players.findIndex(p => p.id === winner.playerId);
    const nextPlayer = gameState.players[gameState.turnIndex];
    io.emit('turnChange', nextPlayer.id);

    // Kazanan Botsa hamle yapsın
    if (nextPlayer.isBot) {
        setTimeout(() => {
            const botCard = getBotMove(nextPlayer);
            handlePlayCard(nextPlayer.id, botCard);
        }, 1000);
    }
}

io.on('connection', (socket) => {
    // 1. Oyuna Katıl
    socket.on('joinGame', (name) => {
        if (gameState.players.length < 4) {
            gameState.players.push({ id: socket.id, name: name, hand: [], isBot: false });
            gameState.scores[socket.id] = 0;
            io.emit('updatePlayers', gameState.players);
            
            // Eğer 4 kişi olduysa başlat butonu açılabilir
            if (gameState.players.length === 4) io.emit('gameReady', true);
        }
    });

    // 2. Botlarla Doldur (YENİ ÖZELLİK)
    socket.on('addBots', () => {
        while (gameState.players.length < 4) {
            const botId = 'bot_' + Math.random().toString(36).substr(2, 5);
            gameState.players.push({ 
                id: botId, 
                name: 'Robot ' + (gameState.players.length), 
                hand: [], 
                isBot: true 
            });
            gameState.scores[botId] = 0;
        }
        io.emit('updatePlayers', gameState.players);
        io.emit('gameReady', true); // Oyun hazır sinyali gönder
    });

    // 3. Oyunu Başlat
    socket.on('startGame', (mode) => {
        gameState.gameMode = mode;
        gameState.deck = createDeck();

        // Kartları dağıt
        gameState.players.forEach((p, i) => {
            p.hand = gameState.deck.slice(i*13, (i+1)*13);
            // Kartları sırala (Renk ve Büyüklük)
            p.hand.sort((a,b) => (a.suit === b.suit) ? b.rank - a.rank : SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit));
            
            if (!p.isBot) io.to(p.id).emit('yourHand', p.hand);
        });

        // Oyunu başlat
        gameState.turnIndex = 0;
        io.emit('gameStarted', { mode: mode });
        io.emit('turnChange', gameState.players[0].id);
    });

    // 4. Kart Atma İsteği (Senden Geliyor)
    socket.on('playCard', (card) => {
        const currentPlayer = gameState.players[gameState.turnIndex];
        // Sıra sende mi ve sen Bot değilsen
        if (currentPlayer.id === socket.id) {
            handlePlayCard(socket.id, card);
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('Sunucu 3000 portunda!'));