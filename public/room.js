const socket = io('https://datn-socket.up.railway.app', { transports: ['websocket'] });

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
socket.emit("join-room", { gameId, roomCode, player: playerName });

// Xử lý khi bị từ chối vào phòng do sai game
socket.on("room-error", ({ message }) => {
  alert(message || "Không thể vào phòng này!");
  window.location.href = "index.html";
});

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
  socket.emit("leave-room", { roomCode, player: playerName });
  window.location.href = "index.html";
};

window.addEventListener("beforeunload", () => {
  socket.emit("leave-room", { roomCode, player: playerName });
});

window.copyCode = function copyCode() {
  navigator.clipboard.writeText(roomCode);
  alert("📋 Mã phòng đã được sao chép!");
};

window.startGame = async function startGame() {
  let gameFolders = [];
  try {
    const res = await fetch('games.json');
    if (res.ok) {
      const games = await res.json();
      // Lấy tất cả id duy nhất từ games.json
      gameFolders = [...new Set(games.map(g => g.id))];
    }
  } catch (e) {
    alert("Không thể tải danh sách game!");
    return;
  }

  let foundFolder = null;

  for (const folder of gameFolders) {
    try {
      const res = await fetch(`game/${folder}/infor.json`);
      if (!res.ok) continue;
      const info = await res.json();
      if (Array.isArray(info)) {
        if (info.some(g => g.id === gameId)) {
          foundFolder = folder;
          break;
        }
      }
    } catch (e) {}
  }

  if (foundFolder) {
    // Gửi sự kiện cho server để thông báo tất cả thành viên
    socket.emit("start-room", { gameId: foundFolder, roomCode, player: playerName });
    // Host cũng tự chuyển hướng (nếu muốn)
    // window.location.href = ...
  } else {
    alert("Không tìm thấy game phù hợp!");
  }
};

socket.on("room-start", ({ gameId, roomCode, player }) => {
  // Lấy tên người chơi hiện tại
  let playerName = player || sessionStorage.getItem("playerName") || "Guest";
  const url = `game/${gameId}/index.html?code=${encodeURIComponent(roomCode)}&user=${encodeURIComponent(playerName)}&gameId=${encodeURIComponent(gameId)}`;
  window.location.href = url;
});