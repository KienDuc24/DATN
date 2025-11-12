// js/room.js
import { allGames, BASE_API_URL, LANGS, currentLang } from './main.js';
import { getGameName, getGameDesc, getUserSafe } from './utils.js';

// Biến cục bộ để lưu game đang chọn
let selectedGameId = null;
let selectedGameName = null;

/**
 * Xử lý khi click vào một game card.
 * Mở modal Tạo/Vào phòng.
 */
export function handleGameClick(gameId, gameName) {
  selectedGameId = gameId;
  selectedGameName = gameName;
  
  const modal = document.getElementById('roomModal');
  if (!modal) return;
  
  modal.style.display = 'flex';

  const game = allGames.find(g => g.id === gameId);
  let infoHtml = '';
  if (game) {
    const name = getGameName(game, currentLang);
    const desc = getGameDesc(game, currentLang);
    const players = game.players || '';
    infoHtml = `
      <div class="modal-game-info">
        <img src="game/${game.id}/Img/logo.png" alt="${name}">
        <div class="modal-game-title">${name}</div>
        <div class="modal-game-desc">${desc}</div>
        <div class="modal-game-players">👥 ${players} ${LANGS[currentLang]?.room_players || 'players'}</div>
      </div>
    `;
  }

  modal.innerHTML = `
    <div class="modal-content">
      <button class="close-btn" id="closeRoomModal">&times;</button>
      ${infoHtml}
      <div class="modal-title">${LANGS[currentLang]?.room_create_or_join || 'Create or join a room'}</div>
      <div class="modal-actions">
        <button id="createRoomBtn">${LANGS[currentLang]?.room_create || 'Create Room'}</button>
        <button id="joinRoomBtn">${LANGS[currentLang]?.room_join || 'Join Room'}</button>
      </div>
      <div id="joinRoomBox" style="display:none;margin-top:18px;text-align:center;">
        <input id="inputJoinRoomCode" placeholder="${LANGS[currentLang]?.room_input_placeholder || 'Enter room code'}">
        <button id="confirmJoinRoomBtn">${LANGS[currentLang]?.room_enter || 'Enter Room'}</button>
      </div>
    </div>
  `;

  // Gán sự kiện cho các nút trong modal
  modal.querySelector('#closeRoomModal').onclick = () => modal.style.display = 'none';
  modal.querySelector('#createRoomBtn').onclick = onCreateRoom;
  modal.querySelector('#joinRoomBtn').onclick = () => {
    modal.querySelector('#joinRoomBox').style.display = 'block';
  };
  modal.querySelector('#confirmJoinRoomBtn').onclick = onJoinRoom;
}

/**
 * Xử lý logic khi nhấn "Tạo phòng".
 */
async function onCreateRoom() {
  const user = getUserSafe() || {};
  const username = user.username || user.displayName || 'Guest';

  if (!selectedGameId || !username) {
    alert('Thiếu thông tin game hoặc người chơi. Vui lòng kiểm tra lại!');
    return;
  }

  try {
    const res = await fetch(`${BASE_API_URL}/api/room`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player: username, game: selectedGameId })
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to create room');
    }

    const data = await res.json();
    const roomCode = data.roomCode || data.code || (data.room && (data.room.id || data.room._id));
    if (!roomCode) {
      alert('Server không trả về mã phòng.');
      return;
    }

    // Chuyển hướng sang room.html
    const qs = new URLSearchParams({
      code: roomCode,
      gameId: selectedGameId,
      game: selectedGameName,
      user: username
    }).toString();

    window.location.href = `/room.html?${qs}`;
  } catch (err) {
    console.error('[client] create room error', err);
    alert('Lỗi khi tạo phòng: ' + err.message);
  }
}

/**
 * Xử lý logic khi nhấn "Xác nhận vào phòng".
 */
async function onJoinRoom() {
  const modal = document.getElementById('roomModal');
  const code = modal.querySelector('#inputJoinRoomCode').value.trim().toUpperCase();
  
  if (!code || !selectedGameId) {
    alert('Thiếu mã phòng hoặc game!');
    return;
  }

  try {
    // Kiểm tra xem phòng có tồn tại không
    const res = await fetch(`${BASE_API_URL}/api/room?code=${encodeURIComponent(code)}&gameId=${encodeURIComponent(selectedGameId)}`);
    if (!res.ok) {
      alert('Không tìm thấy phòng. Vui lòng kiểm tra lại mã phòng.');
      return;
    }
    
    const data = await res.json();
    if (!data.found || !data.room) {
      alert('Phòng không tồn tại hoặc không hợp lệ.');
      return;
    }

    const user = getUserSafe() || {};
    const username = user.username || user.displayName || 'Guest';

    // Chuyển hướng
    const qs = new URLSearchParams({
      code: code,
      gameId: data.room.game.gameId, // Lấy gameId chính xác từ server
      game: data.room.game.type,     // Lấy loại game từ server
      user: username
    }).toString();

    window.location.href = `/room.html?${qs}`;
  } catch (err) {
    console.error('[client] join room error', err);
    alert('Lỗi khi tham gia phòng: ' + err.message);
  }
}