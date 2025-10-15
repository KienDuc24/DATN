const socket = io('https://datn-socket.up.railway.app', { transports: ['websocket'] });

const urlParams = new URLSearchParams(window.location.search);
const roomCode = urlParams.get("code");
const gameName = urlParams.get("game") || "Không xác định";

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

console.log("👤 Tên người dùng hiện tại:", playerName); // Thêm dòng này

// Hiển thị thông tin phòng
if (document.getElementById("roomCode")) document.getElementById("roomCode").innerText = roomCode;
if (document.getElementById("roomCodeDisplay")) document.getElementById("roomCodeDisplay").innerText = roomCode;
if (document.getElementById("gameName")) document.getElementById("gameName").innerText = gameName;
if (document.getElementById("room-username")) document.getElementById("room-username").innerText = playerName;

// Tham gia phòng qua socket
socket.emit("join-room", { gameName, roomCode, player: playerName });

let currentHost = null;

socket.on("update-players", ({ list = [], host }) => {
  currentHost = host;
  console.log("👥 Danh sách người chơi hiện tại:", list); // <--- Thêm dòng này
  const listEl = document.getElementById("playerList");
  if (listEl) {
    if (list.length === 0) {
      listEl.innerHTML = `<li>Chưa có người chơi nào.</li>`;
    } else {
      listEl.innerHTML = list.map(name =>
        `<li>${name} ${name === host ? "(👑 Chủ phòng)" : ""}</li>`
      ).join("");
    }
  }
  const startBtn = document.querySelector(".start-btn");
  if (startBtn) startBtn.style.display = playerName === host ? "inline-block" : "none";
});

window.leaveRoom = function leaveRoom() {
  socket.emit("leave-room", { gameName, roomCode, player: playerName });
  window.location.href = "index.html";
};

window.startGame = function startGame() {
  socket.emit("start-game", { roomCode, player: playerName });
};

socket.on("game-started", async ({ host }) => {
  const gameName = urlParams.get("game");
  try {
    const res = await fetch("/games.json");
    const games = await res.json();
    const selected = games.find(g => g.name === gameName);
    if (selected) {
      const folderId = selected.id;
      window.location.href = `/game/${folderId}/index.html?code=${roomCode}&host=${host}`;
    } else {
      alert("⚠️ Không tìm thấy game tương ứng.");
    }
  } catch (err) {
    console.error("Lỗi khi load game.json:", err);
    alert("Không thể bắt đầu trò chơi.");
  }
});

window.addEventListener("beforeunload", () => {
  socket.emit("leave-room", { roomCode, player: playerName });
});

window.copyCode = function copyCode() {
  navigator.clipboard.writeText(roomCode);
  alert("📋 Mã phòng đã được sao chép!");
};