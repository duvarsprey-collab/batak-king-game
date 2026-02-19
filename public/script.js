const socket = io();
const menu = document.getElementById('menu');
const board = document.getElementById('game-board');
const handContainer = document.getElementById('hand');
const tableCenter = document.getElementById('table-center');

function sec(oyun) {
    socket.emit('secim', oyun);
}

socket.on('oyunBasladi', (data) => {
    menu.style.display = 'none';
    board.style.display = 'block';
    document.getElementById('active-title').innerText = data.oyun;
    
    // Kartları eline diz
    handContainer.innerHTML = '';
    data.kartlar.forEach(kart => {
        const cardDiv = document.createElement('div');
        cardDiv.className = `card ${kart.renk}`;
        cardDiv.innerHTML = `<span>${kart.deger}</span><span>${getSimge(kart.renk)}</span>`;
        cardDiv.onclick = () => kartiAt(kart, cardDiv);
        handContainer.appendChild(cardDiv);
    });
});

function getSimge(renk) {
    const simgeler = { 'S': '♠', 'H': '♥', 'C': '♣', 'D': '♦' };
    return simgeler[renk];
}

function kartiAt(kart, el) {
    socket.emit('kartAt', kart);
    el.remove(); // Elinden çıkar
}

socket.on('kartAtildi', (data) => {
    tableCenter.innerHTML = `<div class="card ${data.kart.renk}">
        <span>${data.kart.deger}</span><span>${getSimge(data.kart.renk)}</span>
    </div>`;
});
