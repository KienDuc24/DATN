const API_BASE = window.__API_BASE__ || ''; // nếu bỏ trống -> relative

async function createRoom(payload) {
  const url = `${window.__API_BASE__ || ''}/api/room`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to create room');
    }
    return await res.json();
  } catch (err) {
    console.error('Create room error:', err.message);
    alert('Không thể tạo phòng. Vui lòng thử lại!');
  }
}

// Socket connect
function initSocket(token){
  const socketUrl = window.__API_BASE__ || undefined; // undefined => same origin
  const socket = io(socketUrl, {
    path: '/socket.io',
    transports: ['websocket', 'polling']
  });
  socket.on('connect', () => {
    if (token) socket.emit('authenticate', token);
  });
  socket.on('auth_error', () => { console.error('Socket auth failed'); });
  return socket;
}

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

async function initRoomPage() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const gameId = params.get('gameId');
  const user = params.get('user') || JSON.parse(localStorage.getItem('user') || '{}').username || 'Guest';

  const BASE_API = window.API_BASE || '';

  function el(id) { return document.getElementById(id); }

  if (!code || !gameId) {
    if (el('roomError')) el('roomError').innerText = 'Missing room code or gameId';
    return;
  }

  try {
    const res = await fetch(`${BASE_API}/api/room?code=${encodeURIComponent(code)}&gameId=${encodeURIComponent(gameId)}`);
    if (!res.ok) {
      el('roomError') && (el('roomError').innerText = `Room not found (${res.status})`);
      return;
    }
    const room = await res.json();

    if (el('roomCode')) el('roomCode').innerText = room.room.code || '(unknown)';
    if (el('roomGame')) el('roomGame').innerText = room.room.game?.type || '(unknown)';
    if (el('roomPlayers')) {
      el('roomPlayers').innerHTML = room.room.players.map(p => `<div>${p}</div>`).join('');
    }

    const socket = io(BASE_API, { path: '/socket.io', transports: ['websocket'], withCredentials: true });
    socket.emit('joinRoom', { code, gameId, user });

    socket.on('update-players', ({ list }) => {
      if (el('roomPlayers')) {
        el('roomPlayers').innerHTML = list.map(p => `<div>${p}</div>`).join('');
      }
    });
  } catch (err) {
    console.error('initRoomPage error', err);
    el('roomError') && (el('roomError').innerText = 'Error loading room');
  }
};