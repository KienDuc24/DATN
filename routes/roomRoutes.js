const express = require('express');
const router = express.Router();
const Room = require('../models/Room');

// helper sinh mã A111
function genRoomCode() {
  const letter = String.fromCharCode(65 + Math.floor(Math.random()*26));
  const num = Math.floor(100 + Math.random()*900);
  return `${letter}${num}`;
}

// POST /api/room  -> tạo phòng
router.post('/room', async (req, res) => {
  try {
    const { player, game } = req.body || {};
    if (!player || !game) return res.status(400).json({ ok:false, message:'player and game required' });

    // tạo code duy nhất (retry ngắn nếu trùng)
    let code, exists, tries = 0;
    do {
      code = genRoomCode();
      exists = await Room.findOne({ code });
      tries++;
    } while (exists && tries < 6);

    const room = new Room({
      code,
      game,
      players: [{ name: player }],
      createdAt: new Date()
    });
    await room.save();

    return res.json({ ok: true, roomCode: code, roomId: room._id });
  } catch (err) {
    console.error('[roomRoutes] create room error', err && err.message);
    return res.status(500).json({ ok:false, message:'server error' });
  }
});

// GET /api/room?code=A111  -> check tồn tại
router.get('/room', async (req, res) => {
  try {
    const code = (req.query.code || '').toUpperCase();
    if (!code) return res.status(400).json({ ok:false, message:'code required' });
    const room = await Room.findOne({ code }).select('-__v');
    if (!room) return res.json({ ok:true, found:false });
    return res.json({ ok:true, found:true, room });
  } catch (err) {
    console.error('[roomRoutes] get room error', err && err.message);
    return res.status(500).json({ ok:false, message:'server error' });
  }
});

module.exports = router;

