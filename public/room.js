// js/room.js

const BASE_API_URL = 'https://datn-socket.up.railway.app'; // URL của socket server

const socket = io(BASE_API_URL, { 
  path: '/socket.io',
  transports: ['websocket', 'polling'] 
});

const urlParams = new URLSearchParams(window.location.search);
const roomCode = urlParams.get('code');
const gameId = urlParams.get('gameId');
const gameName = urlParams.get('game');
const username = urlParams.get('user');

if (!roomCode || !gameId || !gameName || !username) {
  alert('Thiếu thông tin phòng. Vui lòng kiểm tra lại!');
  window.location.href = "index.html"; 
} else {
  console.log('Thông tin phòng:', { roomCode, gameId, gameName, username });
}

let playerName = username; 
if (!playerName) {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  playerName = user.username || user.displayName || user.name;
}
if (!playerName) {
  playerName = sessionStorage.getItem("playerName");
}
if (!playerName) {
  playerName = prompt("Tên của bạn là?");
  if (playerName) sessionStorage.setItem("playerName", playerName);
}
if (!playerName) playerName = "Guest";

console.log("👤 Tên người dùng hiện tại:", playerName);

// Hiển thị thông tin phòng
if (document.getElementById("roomCode")) document.getElementById("roomCode").innerText = roomCode;
if (document.getElementById("roomCodeDisplay")) document.getElementById("roomCodeDisplay").innerText = roomCode;
if (document.getElementById("gameName")) document.getElementById("gameName").innerText = gameName; 
if (document.getElementById("room-username")) document.getElementById("room-username").innerText = playerName;

socket.emit("joinRoom", { code: roomCode, gameId: gameId, user: playerName });

socket.on("room-error", ({ message }) => {
  alert(message || "Không thể vào phòng này!");
  window.location.href = "index.html";
});

let currentHost = null;

socket.on("update-players", ({ list = [], host }) => {
  currentHost = host;
  const isHost = (playerName === host); // Kiểm tra xem bạn có phải chủ phòng không
  console.log("👥 Danh sách người chơi hiện tại:", list);

  const listEl = document.getElementById("playerList");
  if (listEl) {
    if (list.length === 0) {
      listEl.innerHTML = `<li>Chưa có người chơi nào.</li>`;
    } else {
      const sortedList = list.sort((a, b) => (a === host ? -1 : b === host ? 1 : 0));
      
      // --- CẬP NHẬT GIAO DIỆN ---
      // Thêm nút "Kick" nếu bạn là chủ phòng
      listEl.innerHTML = sortedList.map(name => {
        // Nút Kick chỉ hiển thị nếu BẠN là host VÀ người chơi này KHÔNG PHẢI là bạn
        const kickButton = (isHost && name !== host) 
          ? `<button class="kick-btn" onclick="kickPlayer('${name}')">Kick</button>`
          : "";
          
        return `<li>
                  ${name} ${name === host ? "(👑 Chủ phòng)" : ""}
                  ${kickButton}
                </li>`;
      }).join("");
      // ----------------------------
    }
  }

  const startBtn = document.querySelector(".start-btn");
  if (startBtn) startBtn.style.display = isHost ? "inline-block" : "none";
});

window.leaveRoom = function leaveRoom() {
  socket.emit("leaveRoom", { code: roomCode, player: playerName });
  window.location.href = "index.html";
};

window.addEventListener("beforeunload", () => {
  socket.emit("leaveRoom", { code: roomCode, player: playerName });
});

window.copyCode = function copyCode() {
  navigator.clipboard.writeText(roomCode);
  alert("📋 Mã phòng đã được sao chép!");
};

window.startGame = function startGame() {
  console.log('Chủ phòng yêu cầu bắt đầu game...');
  socket.emit('startGame', { code: roomCode });
}

// --- THÊM MỚI (1/2): HÀM GỬI SỰ KIỆN KICK ---
window.kickPlayer = function kickPlayer(playerToKick) {
  if (confirm(`Bạn có chắc muốn kick người chơi "${playerToKick}" không?`)) {
    console.log(`Yêu cầu kick: ${playerToKick}`);
    socket.emit('kickPlayer', { code: roomCode, playerToKick: playerToKick });
  }
}
// ----------------------------------------

// --- THÊM MỚI (2/2): LẮNG NGHE SỰ KIỆN KHI BẠN BỊ KICK ---
socket.on('kicked', () => {
  alert('Bạn đã bị chủ phòng kick ra khỏi phòng!');
  window.location.href = 'index.html';
});
// ------------------------------------------------

socket.on('game-started', (data) => {
  console.log(`Server đã bắt đầu game. Chuyển hướng tới: game/${data.gameId}/index.html`);
  const params = new URLSearchParams({
    code: roomCode,
    gameId: gameId,
    game: gameName,
    user: playerName
  }).toString();
  window.location.href = `game/${data.gameId}/index.html?${params}`;
});