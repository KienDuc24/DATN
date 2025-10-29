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
socket.emit("joinroom", { gameId, roomCode, player: playerName });

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
    // Gửi sự kiện cho server để thông báo tất cả thành viên (không kèm tên host)
    socket.emit("start-room", { gameFolder: foundFolder, roomCode });
    // Host vẫn redirect bằng tên của chính host
    const hostUrl = `game/${foundFolder}/index.html?code=${encodeURIComponent(roomCode)}&user=${encodeURIComponent(playerName)}&gameId=${encodeURIComponent(gameId)}`;
    console.log("Host redirect ->", hostUrl);
    window.location.href = hostUrl;
  } else {
    alert("Không tìm thấy game phù hợp!");
  }
};

// nhận signal từ server để tất cả member tự redirect (với tên riêng của họ)
socket.on('room-start', ({ gameFolder, roomCode: rc }) => {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const userFromUrl = urlParams.get('user');
    const user = sessionStorage.getItem('playerName') || userFromUrl || prompt('Nhập tên để tham gia:') || `guest_${Math.random().toString(36).slice(2,8)}`;
    if (user) sessionStorage.setItem('playerName', user);
    const url = `game/${gameFolder}/index.html?code=${encodeURIComponent(rc)}&user=${encodeURIComponent(user)}&gameId=${encodeURIComponent(gameId)}`;
    console.log('Member redirect ->', url);
    window.location.href = url;
  } catch (e) {
    console.error('room-start handler error', e);
  }
});

document.addEventListener('DOMContentLoaded', function () {
  // ensure SOCKET_URL is set (script.js sets window.SOCKET_URL)
  const socketUrl = window.SOCKET_URL || window.location.origin;
  const socket = io(socketUrl, { withCredentials: true });

  // parse room code from query param or page DOM
  const params = new URLSearchParams(window.location.search);
  const roomCode = (params.get('code') || document.getElementById('roomCode')?.textContent || '').toUpperCase();

  // username from localStorage user object if present, otherwise guest_...
  let username = (() => {
    try {
      const u = localStorage.getItem('user');
      if (u) {
        const parsed = JSON.parse(u);
        return parsed.name || parsed.username || parsed.displayName || parsed.email || `guest_${Math.random().toString(36).slice(2,8)}`;
      }
    } catch (e) {}
    return `guest_${Math.random().toString(36).slice(2,8)}`;
  })();

  const playersArea = document.getElementById('playersArea');
  if (playersArea) playersArea.textContent = 'Đang tải...';

  socket.on('connect', () => {
    console.log('socket connected', socket.id, '-> joining', roomCode, username);
    if (roomCode) socket.emit('joinRoom', { code: roomCode, username });
  });

  // update players list UI
  socket.on('room:players', ({ players } = {}) => {
    if (!playersArea) return;
    if (!players || players.length === 0) {
      playersArea.textContent = 'Chưa có người chơi';
      return;
    }
    // build simple list
    const ul = document.createElement('ul');
    ul.className = 'players-list';
    players.forEach(p => {
      const li = document.createElement('li');
      li.textContent = p;
      ul.appendChild(li);
    });
    // replace content
    playersArea.innerHTML = '';
    playersArea.appendChild(ul);
  });

  socket.on('connect_error', (err) => {
    console.error('socket connect_error', err);
    if (playersArea) playersArea.textContent = 'Lỗi kết nối socket';
  });

  // emit leave when closing the page
  window.addEventListener('beforeunload', () => {
    if (roomCode) socket.emit('leaveRoom', { code: roomCode });
  });

  // optional: provide a "Thoát phòng" button handler if exists
  const leaveBtn = document.getElementById('leaveRoomBtn');
  if (leaveBtn) {
    leaveBtn.addEventListener('click', () => {
      if (roomCode) socket.emit('leaveRoom', { code: roomCode });
      // immediate UI feedback
      if (playersArea) playersArea.textContent = 'Đang tải...';
    });
  }
});

