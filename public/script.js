const socket = io();

function sec(oyun) {
    socket.emit('secim', oyun);
}

socket.on('oyunBasladi', (oyun) => {
    // Replit AI Mantığı: Ekranlar arası geçiş
    document.getElementById('menu').style.display = 'none';
    document.getElementById('game-board').style.display = 'block';
    document.getElementById('active-title').innerText = oyun + " Masası";
    
    console.log(oyun + " başarıyla yüklendi kanka!");
});