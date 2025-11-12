// js/room.js

const BASE_API_URL = 'https://datn-socket.up.railway.app'; // URL của socket server

// Socket connect
// (Đoạn code initSocket cũ của bạn không được dùng, đoạn này đang được dùng)
const socket = io(BASE_API_URL, { 
  path: '/socket.io', // Thêm path nếu server bạn có cấu hình
  transports: ['websocket', 'polling'] 
});

const urlParams = new URLSearchParams(window.location.search);
const roomCode = urlParams.get('code');
const gameId = urlParams.get('gameId');
const gameName = urlParams.get('game');
const username = urlParams.get('user');

if (!roomCode || !gameId || !gameName || !username) {
  alert('Thiếu thông tin phòng. Vui lòng kiểm tra lại!');
  window.location.href = "index.html"; // Quay về trang chủ nếu thiếu
} else {
  console.log('Thông tin phòng:', { roomCode, gameId, gameName, username });
}

// Lấy tên người chơi (Ưu tiên từ URL)
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
if (document.getElementById("gameName")) document.getElementById("gameName").innerText = gameName; // Lấy gameName từ URL
if (document.getElementById("room-username")) document.getElementById("room-username").innerText = playerName;

// --- SỬA LỖI 1 ---
// Tham gia phòng qua socket
// Backend mong đợi "code", không phải "roomCode"
socket.emit("joinRoom", { code: roomCode, gameId: gameId, user: playerName });

// Xử lý khi bị từ chối vào phòng
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

  // Hiển thị nút "Bắt đầu" nếu là chủ phòng
  const startBtn = document.querySelector(".start-btn");
  if (startBtn) startBtn.style.display = playerName === host ? "inline-block" : "none";
});

// Hàm rời phòng
window.leaveRoom = function leaveRoom() {
  // --- SỬA LỖI 2 ---
  // Backend mong đợi "code", không phải "roomCode"
  socket.emit("leaveRoom", { code: roomCode, player: playerName });
  window.location.href = "index.html";
};

// Tự động rời phòng khi đóng tab/trình duyệt
window.addEventListener("beforeunload", () => {
  // --- SỬA LỖI 3 ---
  // Backend mong đợi "code", không phải "roomCode"
  socket.emit("leaveRoom", { code: roomCode, player: playerName });
});

// Hàm sao chép mã phòng
window.copyCode = function copyCode() {
  navigator.clipboard.writeText(roomCode);
  alert("📋 Mã phòng đã được sao chép!");
};

