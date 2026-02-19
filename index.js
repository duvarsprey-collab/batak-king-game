const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

// --- SABİTLER ---
const SUITS = ['S', 'H', 'C', 'D']; 
const VALUES = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

let gameState = {
    players: [],
    deck: [],
    table: [],
    turnIndex: 0,
    gameMode: null, // 'batak', 'king'
    trump: null,    // 'S', 'H', 'C', 'D' veya null
    contract: null, // 'rifki', 'kiz', 'el' vb.
    scores: {},
    phase: 'lobby'  // lobby, selection, playing
};

function createDeck() {
    let deck = [];
    SUITS.forEach(s => VALUES.forEach(v => {
        deck.push({ suit: s, value: v, rank: VALUES.indexOf(v), id: s+v });
    }));
    return deck.sort(() => Math.random() - 0.5);
}

// Botun oynayacağı kartı seçmesi
function getBotMove(player) {
    // Yer boşsa
    if (gameState.table.length === 0) {
        return player.hand[Math.floor(Math.random() * player.hand.length)];
    }

    const leadSuit = gameState.table[0].card.suit;
    const cardsOfSuit = player.hand.filter(c => c.suit === leadSuit);

    // Yerdeki renkten varsa at
    if (cardsOfSuit.length > 0) return cardsOfSuit[0]; // Basit mantık: ilkini at

    // Yoksa ve Koz varsa, koz at (Batak için)
    if (gameState.trump) {
        const trumps = player.hand.filter(c => c.suit === gameState.trump);
        if (trumps.length > 0) return trumps[0];
    }

    // Hiçbiri yoksa en küçüğü at
    return player.hand[0];
}

function handlePlayCard(playerId, card) {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return;

    // Kartı elden düş
    player.hand = player.hand.filter(c => c.id !== card.id);
    if (!player.isBot) io.to(playerId).emit('yourHand', player.hand);

    // Masaya koy
    gameState.table.push({ playerId, card });
    io.emit('tableUpdate', gameState.table);

    // Sıra değiştir
    gameState.turnIndex = (gameState.turnIndex + 1) % 4;
    const nextPlayer = gameState.players[gameState.turnIndex];
    io.emit('turnChange', nextPlayer.id);

    // El bitti mi?
    if (gameState.table.length === 4) {
        setTimeout(finishTrick, 1500);
    } else {
        // Sıradaki bot ise oynasın
        if (nextPlayer.isBot) {
            setTimeout(() => {
                const botCard = getBotMove(nextPlayer);
                handlePlayCard(nextPlayer.id, botCard);
            }, 1000);
        }
    }
}

function finishTrick() {
    let winner = gameState.table[0];
    const leadSuit = winner.card.suit;

    gameState.table.forEach(move => {
        // Koz kontrolü
        if (gameState.trump && move.card.suit === gameState.trump && winner.card.suit !== gameState.trump) {
            winner = move;
        } else if (move.card.suit === leadSuit && move.card.rank > winner.card.rank) {
            // Eğer koz yoksa ve aynı renkse büyüğüne bak
             if (!gameState.trump || winner.card.suit !== gameState.trump) {
                 winner = move;
             }
        }
        // İkisi de kozsa
        else if (gameState.trump && move.card.suit === gameState.trump && winner.card.suit === gameState.trump) {
            if (move.card.rank > winner.card.rank) winner = move;
        }
    });

    gameState.scores[winner.playerId] = (gameState.scores[winner.playerId] || 0) + 1;
    io.emit('updateScores', gameState.scores);
    
    gameState.table = [];
    io.emit('tableUpdate', []);

    // Kazanan başlar
    gameState.turnIndex = gameState.players.findIndex(p => p.id === winner.playerId);
    const nextPlayer = gameState.players[gameState.turnIndex];
    io.emit('turnChange', nextPlayer.id);

    if (nextPlayer.isBot) {
        setTimeout(() => {
            const botCard = getBotMove(nextPlayer);
            handlePlayCard(nextPlayer.id, botCard);
        }, 1000);
    }
}

io.on('connection', (socket) => {
    socket.on('joinGame', (name) => {
        if (gameState.players.length < 4) {
            gameState.players.push({ id: socket.id, name, hand: [], isBot: false });
            gameState.scores[socket.id] = 0;
            io.emit('updatePlayers', gameState.players);
            if (gameState.players.length === 4) io.emit('gameReady', true);
        }
    });

    socket.on('addBots', () => {
        while (gameState.players.length < 4) {
            const id = 'bot_' + Math.random().toString(36).substr(2, 5);
            gameState.players.push({ id, name: 'Bot ' + (gameState.players.length), hand: [], isBot: true });
            gameState.scores[id] = 0;
        }
        io.emit('updatePlayers', gameState.players);
        io.emit('gameReady', true);
    });

    socket.on('startGame', (mode) => {
        gameState.gameMode = mode;
        gameState.deck = createDeck();
        gameState.phase = 'selection'; // Önce seçim ekranı!
        
        // Kartları dağıt
        gameState.players.forEach((p, i) => {
            p.hand = gameState.deck.slice(i*13, (i+1)*13);
            p.hand.sort((a,b) => (a.suit === b.suit) ? b.rank - a.rank : SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit));
            if (!p.isBot) io.to(p.id).emit('yourHand', p.hand);
        });

        // Oyunu başlatan kişiye (Sana) seçim ekranını gönder
        io.emit('gameStarted', { mode });
        
        // Sadece insan oyuncuya soruyoruz
        const humanPlayer = gameState.players.find(p => !p.isBot);
        if (humanPlayer) {
            io.to(humanPlayer.id).emit('askSelection', mode);
        }
    });

    // Koz veya Oyun Seçildiğinde
    socket.on('selectionMade', (data) => {
        gameState.phase = 'playing';
        if (data.type === 'trump') {
            gameState.trump = data.value;
            io.emit('updateInfo', { text: 'KOZ: ' + data.value, icon: data.value });
        } else {
            gameState.contract = data.value;
            gameState.trump = (data.value === 'koz') ? 'S' : null; // Basitlik: King Koz oyununda Maça varsayalım veya tekrar soralım.
            io.emit('updateInfo', { text: 'OYUN: ' + data.value.toUpperCase(), icon: null });
        }

        gameState.turnIndex = 0; // Oyunu sen başlat
        io.emit('turnChange', gameState.players[0].id);
    });

    socket.on('playCard', (card) => {
        if (gameState.phase !== 'playing') return;
        const player = gameState.players[gameState.turnIndex];
        if (player.id === socket.id) handlePlayCard(socket.id, card);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('Sunucu Hazır 3000!'));