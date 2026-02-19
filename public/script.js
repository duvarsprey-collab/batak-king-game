const socket = io();
let myHand = [];

function joinGame() {
    const name = document.getElementById('username').value || 'Misafir';
    socket.emit('joinGame', name);
    document.getElementById('bot-btn').style.display = 'inline-block';
}
function addBots() { socket.emit('addBots'); }
function startGame(mode) { socket.emit('startGame', mode); }

// Oyuncu Listesi
socket.on('updatePlayers', p => {
    document.getElementById('player-list').innerHTML = p.map(x => `👤 ${x.name}`).join('<br>');
});
socket.on('gameReady', () => {
    document.getElementById('mode-select').style.display = 'block';
    document.getElementById('bot-btn').style.display = 'none';
});

// Oyun Başlayınca
socket.on('gameStarted', () => {
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
});

// SEÇİM EKRANI AÇMA (CRITICAL UPDATE)
socket.on('askSelection', (mode) => {
    document.getElementById('modal-overlay').style.display = 'flex';
    if (mode === 'batak') {
        document.getElementById('trump-modal').style.display = 'block';
    } else {
        document.getElementById('king-modal').style.display = 'block';
    }
});

function makeSelection(type, value) {
    socket.emit('selectionMade', { type, value });
    document.getElementById('modal-overlay').style.display = 'none';
    document.querySelectorAll('.modal-content').forEach(el => el.style.display = 'none');
}

// BİLGİ GÜNCELLEME (SOL ÜST)
socket.on('updateInfo', (data) => {
    document.getElementById('game-status').innerText = data.text;
    if(data.icon) {
        const icons = {'S':'♠️', 'H':'♥️', 'C':'♣️', 'D':'♦️'};
        document.getElementById('trump-indicator').innerText = icons[data.icon] || '';
    } else {
        document.getElementById('trump-indicator').innerText = '';
    }
});

// Kartlar ve Oyun
socket.on('yourHand', (hand) => {
    const div = document.getElementById('my-hand');
    div.innerHTML = '';
    hand.forEach(c => {
        const el = document.createElement('div');
        el.className = `card ${c.suit}`;
        el.innerHTML = `<b>${c.value}</b><div style="font-size:30px; text-align:center;">${getIcon(c.suit)}</div>`;
        el.onclick = () => socket.emit('playCard', c);
        div.appendChild(el);
    });
});

socket.on('tableUpdate', (table) => {
    const div = document.getElementById('table-area');
    div.innerHTML = '';
    table.forEach((m, i) => {
        const el = document.createElement('div');
        el.className = 'played-card';
        el.style.left = `calc(50% + ${(i-1.5)*60}px)`; // Ortala
        el.innerHTML = `${m.card.value} ${getIcon(m.card.suit)}`;
        if('HD'.includes(m.card.suit)) el.style.color = 'red';
        div.appendChild(el);
    });
});

function getIcon(s) { return {'S':'♠', 'H':'♥', 'C':'♣', 'D':'♦'}[s]; }