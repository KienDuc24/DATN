let rooms = {};

function generateRoomCode() {
  const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const number = Math.floor(100 + Math.random() * 900);
  return letter + number;
}

export default async function handler(req, res) {
  const isLeave = req.url.includes('/leave');

  if (req.method === 'POST' && isLeave) {
    // Người chơi rời phòng
    const { roomCode, player } = req.body;
    if (rooms[roomCode]) {
      const member = rooms[roomCode].players.find(p => p.name === player);
      if (member) member.active = false;
    }
    return res.status(200).json({ left: true });
  }

  if (req.method === 'POST') {
    const { player, roomCode, game } = req.body;

    if (!roomCode) {
      // Tạo phòng
      const newCode = generateRoomCode();
      rooms[newCode] = { players: [{ name: player, active: true }], game };
      res.status(200).json({ roomCode: newCode, players: [player] });
    } else {
      // Tham gia phòng
      if (rooms[roomCode]) {
        rooms[roomCode].players.push({ name: player, active: true });
        res.status(200).json({
          success: true,
          players: rooms[roomCode].players.filter(p => p.active).map(p => p.name),
          game: rooms[roomCode].game
        });
      } else {
        res.status(200).json({ success: false, message: 'Room not found' });
      }
    }
  } else if (req.method === 'GET') {
    const { code } = req.query;
    if (rooms[code]) {
      const activePlayers = rooms[code].players.filter(p => p.active);
      res.status(200).json({ found: true, players: activePlayers.map(p => p.name) });
    } else {
      res.status(200).json({ found: false });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
