const BASE_API_URL = window.BASE_API_URL || 'https://datn-smoky.vercel.app';

async function createRoom(payload) {
  try {
    const res = await fetch(`${BASE_API_URL}/api/room`, { // Đảm bảo URL đúng
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to create room');
    }
    const room = await res.json();
    console.log('[createRoom] Room created:', room);

    // Chuyển hướng sang room.html với mã phòng
    window.location.href = `room.html?code=${room.roomCode}&gameId=${payload.game}`;
  } catch (err) {
    console.error('[createRoom] Error:', err.message);
    alert('Không thể tạo phòng. Vui lòng thử lại!');
  }
}

// Socket connect
function initSocket(token) {
  const socketUrl = window.__BASE_API__ || undefined; // undefined => same origin
  const socket = io(socketUrl, {
    path: '/socket.io',
    transports: ['websocket', 'polling']
  });
  socket.on('connect', () => {
    if (token) socket.emit('authenticate', token);
  });
  socket.on('auth_error', () => {
    console.error('Socket auth failed');
  });
  return socket;
}

const socket = io(BASE_API_URL, { transports: ['websocket'] });

const urlParams = new URLSearchParams(window.location.search);
const roomCode = urlParams.get("code");
const gameId = urlParams.get("gameId");

// Lấy tên người chơi
let playerName = urlParams.get("user");
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
if (document.getElementById("gameName")) document.getElementById("gameName").innerText = gameId;
if (document.getElementById("room-username")) document.getElementById("room-username").innerText = playerName;

// Tham gia phòng qua socket
socket.emit("joinRoom", { gameId, roomCode, user: playerName });

// Xử lý khi bị từ chối vào phòng do sai game
socket.on("room-error", ({ message }) => {
  alert(message || "Không thể vào phòng này!");
  window.location.href = "index.html";
});

let currentHost = null;

socket.on("update-players", ({ list = [], host }) => {
  currentHost = host;
  console.log("👥 Danh sách người chơi hiện tại:", list);

  const listEl = document.getElementById("playerList");
  if (listEl) {
    if (list.length === 0) {
      listEl.innerHTML = `<li>Chưa có người chơi nào.</li>`;
    } else {
      // Đảm bảo host luôn đứng đầu danh sách
      const sortedList = list.sort((a, b) => (a === host ? -1 : b === host ? 1 : 0));
      listEl.innerHTML = sortedList.map(name =>
        `<li>${name} ${name === host ? "(👑 Chủ phòng)" : ""}</li>`
      ).join("");
    }
  }

  const startBtn = document.querySelector(".start-btn");
  if (startBtn) startBtn.style.display = playerName === host ? "inline-block" : "none";
});

window.leaveRoom = function leaveRoom() {
  socket.emit("leaveRoom", { roomCode, player: playerName });
  window.location.href = "index.html";
};

window.addEventListener("beforeunload", () => {
  socket.emit("leaveRoom", { roomCode, player: playerName });
});

window.copyCode = function copyCode() {
  navigator.clipboard.writeText(roomCode);
  alert("📋 Mã phòng đã được sao chép!");
};