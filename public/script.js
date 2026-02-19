const socket = io();
let myHand = [];

function joinGame() {
    const name = document.getElementById('username').value;
    if(!name) return alert("Adını yaz kanka!");
    socket.emit('joinGame', name);
    // Masaya oturduktan sonra Bot butonunu göster
    document.getElementById('bot-controls').style.display = 'block';
}

function addBots() {
    socket.emit('addBots');
    document.getElementById('bot-controls').style.display = 'none'; // Butonu gizle
}

function startGame(mode) {
    socket.emit('startGame', mode);
}

socket.on('updatePlayers', (players) => {
    let html = '<h3>Masadakiler:</h3>';
    players.forEach(p => html += `<div>👤 ${p.name}</div>`);
    document.getElementById('player-list').innerHTML = html;
});

socket.on('gameReady', () => {
    document.getElementById('game-modes').style.display = 'block';
    document.getElementById('bot-controls').style.display = 'none';
});

socket.on('gameStarted', () => {
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
});

socket.on('yourHand', (hand) => {
    myHand = hand;
    renderHand();
});

function renderHand() {
    const div = document.getElementById('my-hand');
    div.innerHTML = '';
    myHand.forEach(card => {
        const cardDiv = document.createElement('div');
        cardDiv.className = `card ${card.suit}`;
        cardDiv.innerHTML = `${card.value} <br> <span style="font-size:24px">${getIcon(card.suit)}</span>`;
        cardDiv.onclick = () => socket.emit('playCard', card);
        div.appendChild(cardDiv);
    });
}

socket.on('tableUpdate', (table) => {
    const div = document.getElementById('table-area');
    div.innerHTML = '';
    table.forEach((move, i) => {
        const c = document.createElement('div');
        c.className = 'played-card';
        c.style.left = (i * 30) + 'px'; // Kartları yan yana diz
        c.innerHTML = `${move.card.value} ${getIcon(move.card.suit)}`;
        if (move.card.suit === 'H' || move.card.suit === 'D') c.style.color = 'red';
        div.appendChild(c);
    });
});

socket.on('turnChange', (id) => {
    const status = document.getElementById('status-msg');
    if (id === socket.id) {
        status.innerText = "SIRA SENDE! Kart At.";
        status.style.color = "#f1c40f"; // Altın sarısı
    } else {
        status.innerText = "Rakip düşünüyor...";
        status.style.color = "white";
    }
});

socket.on('updateScores', (scores) => {
    let html = '';
    for (let [id, sc] of Object.entries(scores)) {
        html += `<span style="margin:10px;">Puan: ${sc}</span>`;
    }
    document.getElementById('score-board').innerHTML = html;
});

function getIcon(s) { return {'S':'♠', 'H':'♥', 'C':'♣', 'D':'♦'}[s]; }