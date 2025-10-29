const express = require('express');
const router = express.Router();
let rooms = {};

function generateRoomCode() {
  const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const number = Math.floor(100 + Math.random() * 900);
  return letter + number;
}

// Tạo phòng hoặc tham gia phòng
function createRoom(req, res) {
  const { player, roomCode, game } = req.body;
  if (!roomCode) {
    const newCode = generateRoomCode();
    rooms[newCode] = { players: [{ name: player, active: true }], game };
    return res.status(200).json({ roomCode: newCode, players: [player] });
  } else {
    if (rooms[roomCode]) {
      rooms[roomCode].players.push({ name: player, active: true });
      return res.status(200).json({
        success: true,
        players: rooms[roomCode].players.filter(p => p.active).map(p => p.name),
        game: rooms[roomCode].game
      });
    } else {
      return res.status(200).json({ success: false, message: 'Room not found' });
    }
  }
}

router.post('/', createRoom);
router.post('/create', roomController.createRoom);

// Rời phòng
router.post('/leave', (req, res) => {
  const { roomCode, player } = req.body;
  if (rooms[roomCode]) {
    const member = rooms[roomCode].players.find(p => p.name === player);
    if (member) member.active = false;
  }
  return res.status(200).json({ left: true });
});

// Lấy danh sách người chơi trong phòng
router.get('/', (req, res) => {
  const { code } = req.query;
  if (rooms[code]) {
    const activePlayers = rooms[code].players.filter(p => p.active);
    return res.status(200).json({ found: true, players: activePlayers.map(p => p.name) });
  } else {
    return res.status(200).json({ found: false });
  }
});

module.exports = router;