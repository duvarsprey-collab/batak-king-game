const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

// --- OYUN SABİTLERİ VE MANTIK ---
const SUITS = ['S', 'H', 'C', 'D']; // Maça, Kupa, Sinek, Karo
const VALUES = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

let gameState = {
    players: [], // {id, name, hand, team}
    deck: [],
    table: [], // {playerId, card}
    turnIndex: 0,
    gameMode: null, // 'batak', 'king'
    trumpSuit: null, // Koz
    bidWinner: null, // İhaleyi alan
    currentBid: 0,
    kingContract: null, // 'rifki', 'kiz', 'el' vb.
    scores: {},
    phase: 'lobby' // lobby, bidding, selecting_contract, playing
};

// Deste Oluştur ve Karıştır
function createDeck() {
    let deck = [];
    SUITS.forEach(s => VALUES.forEach(v => {
        deck.push({ 
            suit: s, 
            value: v, 
            rank: VALUES.indexOf(v),
            id: s+v 
        });
    }));
    return deck.sort(() => Math.random() - 0.5);
}

// Kural Kontrolü: Oyuncu o kartı atabilir mi?
function isValidMove(playerHand, card, table) {
    if (table.length === 0) return true; // İlk kartı atan istediğini atar
    
    const leadSuit = table[0].card.suit;
    const hasLeadSuit = playerHand.some(c => c.suit === leadSuit);
    
    // 1. Kural: Yerdeki renkten varsa onu atmak ZORUNDASIN
    if (hasLeadSuit && card.suit !== leadSuit) return false;
    
    // 2. Kural: Yerdeki renk yoksa ve elinde koz varsa çakmak zorundasın (Batak için)
    // Şimdilik basitleştirilmiş: Renk yoksa istediğini atabilir (Ama koz varsa koz atması önerilir)
    return true;
}

// Eli Kim Kazandı?
function calculateTrickWinner() {
    let winner = gameState.table[0];
    const leadSuit = winner.card.suit;
    
    gameState.table.forEach(move => {
        // Koz varsa kozu atan alır (Batak veya King Koz oyunuysa)
        if (gameState.trumpSuit && move.card.suit === gameState.trumpSuit && winner.card.suit !== gameState.trumpSuit) {
            winner = move;
        }
        // İkisi de kozsa büyük koz alır
        else if (gameState.trumpSuit && move.card.suit === gameState.trumpSuit && winner.card.suit === gameState.trumpSuit) {
            if (move.card.rank > winner.card.rank) winner = move;
        }
        // Koz yoksa, yerdeki renkten en büyüğü alır
        else if (move.card.suit === leadSuit && move.card.rank > winner.card.rank) {
            winner = move;
        }
    });
    return winner;
}

io.on('connection', (socket) => {
    console.log('Oyuncu geldi:', socket.id);

    // Oyuna Katılma
    socket.on('joinGame', (name) => {
        if (gameState.players.length < 4) {
            gameState.players.push({ id: socket.id, name: name || `Oyuncu ${gameState.players.length+1}`, hand: [], score: 0 });
            gameState.scores[socket.id] = 0;
            io.emit('updatePlayers', gameState.players);
            
            if (gameState.players.length === 4) {
                io.emit('gameReady', true);
            }
        }
    });

    // Oyunu Başlat (Batak veya King)
    socket.on('startGame', (mode) => {
        gameState.gameMode = mode;
        gameState.deck = createDeck();
        
        // Kartları Dağıt (13'er tane)
        gameState.players.forEach((p, index) => {
            p.hand = gameState.deck.slice(index*13, (index+1)*13).sort((a,b) => {
                if(a.suit === b.suit) return b.rank - a.rank; // Kendi içinde sırala
                return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
            });
            io.to(p.id).emit('yourHand', p.hand);
        });

        gameState.turnIndex = 0;
        gameState.phase = mode === 'batak' ? 'bidding' : 'selecting_contract';
        
        io.emit('gameStarted', { mode: mode, turn: gameState.players[0].id });
        io.emit('phaseChange', gameState.phase); // İhale veya Seçim ekranını aç
    });

    // Batak: İhale Verme
    socket.on('bid', (amount) => {
        // Basit ihale: Herkes sırayla söyler, en yüksek alan kalır (Burayı basitleştirdim)
        gameState.currentBid = amount;
        gameState.bidWinner = socket.id;
        gameState.phase = 'selecting_trump';
        io.to(socket.id).emit('selectTrump', true); // Sadece kazanan koz seçsin
        io.emit('systemMessage', `${gameState.players.find(p=>p.id===socket.id).name} ihaleyi ${amount} ile aldı!`);
    });

    // Koz Seçimi (Batak) veya King Sözleşmesi
    socket.on('selectTrump', (suit) => {
        gameState.trumpSuit = suit;
        gameState.phase = 'playing';
        io.emit('trumpSelected', suit);
        io.emit('phaseChange', 'playing');
    });

    // King: Ceza/Koz Seçimi
    socket.on('selectContract', (contract) => {
        gameState.kingContract = contract;
        if (contract === 'koz') {
             // Koz seçimi için arayüzü tetikle
             io.to(socket.id).emit('selectTrump', true);
        } else {
            gameState.phase = 'playing';
            gameState.trumpSuit = null; // Ceza oyunlarında koz yoktur
            io.emit('kingContractSelected', contract);
            io.emit('phaseChange', 'playing');
        }
    });

    // Kart Atma (Oyunun Kalbi)
    socket.on('playCard', (card) => {
        // Sıra sende mi?
        if (socket.id !== gameState.players[gameState.turnIndex].id) return;
        
        const player = gameState.players.find(p => p.id === socket.id);
        
        // Kurala uygun mu?
        if (!isValidMove(player.hand, card, gameState.table)) {
            socket.emit('invalidMove', 'Yerdeki renkten atmalısın!');
            return;
        }

        // Kartı elinden sil
        player.hand = player.hand.filter(c => c.id !== card.id);
        socket.emit('yourHand', player.hand); // Eli güncelle

        // Masaya koy
        gameState.table.push({ playerId: socket.id, card: card });
        io.emit('tableUpdate', gameState.table);

        // Sırayı değiştir
        gameState.turnIndex = (gameState.turnIndex + 1) % 4;
        io.emit('turnChange', gameState.players[gameState.turnIndex].id);

        // El bitti mi? (4 kart atıldıysa)
        if (gameState.table.length === 4) {
            setTimeout(() => {
                const winnerMove = calculateTrickWinner();
                const winnerId = winnerMove.playerId;
                
                // King Puanlama (Basit Örnekler)
                if (gameState.gameMode === 'king') {
                    if (gameState.kingContract === 'el_almaz') gameState.scores[winnerId] -= 50;
                    else if (gameState.kingContract === 'rifki' && gameState.table.some(m => m.card.suit === 'H' && m.card.value === 'K')) gameState.scores[winnerId] -= 320;
                    else gameState.scores[winnerId] += 50; // Pozitif oyun
                } else {
                    // Batak Puanlama
                    gameState.scores[winnerId] += 10; 
                }

                io.emit('updateScores', gameState.scores);
                io.emit('trickFinished', winnerId);
                
                // Masayı temizle, kazanan başlar
                gameState.table = [];
                gameState.turnIndex = gameState.players.findIndex(p => p.id === winnerId);
                io.emit('tableUpdate', []);
                io.emit('turnChange', winnerId);
            }, 1500); // 1.5 saniye bekle ki millet kartları görsün
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('Sunucu 3000 portunda!'));