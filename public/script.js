const socket = io();
let myHand = [];
let myTurn = false;

// Lobi Fonksiyonları
function joinGame() {
    const name = document.getElementById('username').value;
    if(!name) return alert("Adını yaz kanka!");
    socket.emit('joinGame', name);
    document.getElementById('lobby').innerHTML += '<p>Katıldın, diğerleri bekleniyor...</p>';
}

function startGame(mode) {
    socket.emit('startGame', mode);
}

socket.on('gameReady', () => {
    document.getElementById('game-modes').style.display = 'block';
});

// Oyun Başlayınca
socket.on('gameStarted', (data) => {
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
});

// Elimizdeki Kartları Çiz
socket.on('yourHand', (hand) => {
    myHand = hand;
    const handDiv = document.getElementById('my-hand');
    handDiv.innerHTML = '';
    
    hand.forEach(card => {
        const div = document.createElement('div');
        div.className = `card ${card.suit}`;
        div.innerHTML = `
            <div style="font-size:20px; padding-left:5px;">${card.value}</div>
            <div style="font-size:40px; text-align:center;">${getSuitIcon(card.suit)}</div>
        `;
        div.onclick = () => playCard(card);
        handDiv.appendChild(div);
    });
});

// Faz (Phase) Değişiklikleri
socket.on('phaseChange', (phase) => {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); // Hepsini kapat
    
    if (phase === 'bidding') document.getElementById('bidding-modal').style.display = 'block';
    else if (phase === 'selecting_contract') document.getElementById('king-modal').style.display = 'block';
});

socket.on('selectTrump', () => {
    document.getElementById('trump-modal').style.display = 'block';
});

// Aksiyonlar
function sendBid(amount) {
    socket.emit('bid', amount);
    document.getElementById('bidding-modal').style.display = 'none';
}

function selectContract(type) {
    socket.emit('selectContract', type);
    document.getElementById('king-modal').style.display = 'none';
}

function selectTrump(suit) {
    socket.emit('selectTrump', suit);
    document.getElementById('trump-modal').style.display = 'none';
    document.getElementById('king-modal').style.display = 'none';
}

function playCard(card) {
    if (!myTurn) return alert("Sıra sende değil kanka!");
    socket.emit('playCard', card);
}

// Masa Güncelleme
socket.on('tableUpdate', (table) => {
    const tableDiv = document.getElementById('table-area');
    tableDiv.innerHTML = '';
    table.forEach((move, index) => {
        const div = document.createElement('div');
        div.className = 'played-card';
        div.style.left = (index * 20) + 'px'; // Kartları yan yana hafif kaydır
        div.innerHTML = `${move.card.value} ${getSuitIcon(move.card.suit)}`;
        if(move.card.suit === 'H' || move.card.suit === 'D') div.style.color = 'red';
        tableDiv.appendChild(div);
    });
});

socket.on('turnChange', (playerId) => {
    myTurn = (playerId === socket.id);
    document.getElementById('status-msg').innerText = myTurn ? "SIRA SENDE!" : "Rakip düşünür...";
    document.getElementById('status-msg').style.color = myTurn ? "#f1c40f" : "white";
});

socket.on('updateScores', (scores) => {
    let html = '';
    for (const [id, score] of Object.entries(scores)) {
        html += `<div>Oyuncu: ${score}</div>`;
    }
    document.getElementById('score-board').innerHTML = html;
});

socket.on('invalidMove', (msg) => alert(msg));

// Yardımcılar
function getSuitIcon(suit) {
    return {'S':'♠', 'H':'♥', 'C':'♣', 'D':'♦'}[suit];
}