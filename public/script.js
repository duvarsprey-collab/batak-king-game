const socket = io();
let myCards = [];
let currentMode = '';

function startGame(mode) {
    currentMode = mode;
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('game-area').style.display = 'block';
    socket.emit('joinGame', mode);
}

socket.on('initGame', (data) => {
    myCards = data.cards;
    const hand = document.getElementById('player-hand');
    hand.innerHTML = '';
    myCards.forEach(k => {
        const div = document.createElement('div');
        div.className = `card ${k.suit}`;
        div.innerHTML = `<div>${k.value}</div><div style="font-size:24px">${getIcon(k.suit)}</div>`;
        div.onclick = () => playCard(k, div);
        hand.appendChild(div);
    });
});

function getIcon(s) { return {S:'♠', H:'♥', C:'♣', D:'♦'}[s]; }

function playCard(card, el) {
    // [Çıkarım] Batak kuralı: Eğer yerdeki karttan büyüğü varsa onu atmak zorundasın
    socket.emit('playCard', { card, mode: currentMode });
    el.remove();
}

socket.on('cardPlayed', (data) => {
    const middle = document.getElementById('deck-middle');
    const div = document.createElement('div');
    div.className = `card ${data.card.suit}`;
    div.innerHTML = `<div>${data.card.value}</div><div>${getIcon(data.card.suit)}</div>`;
    middle.innerHTML = ''; // Önceki kartı temizle
    middle.appendChild(div);
});