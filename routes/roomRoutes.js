const express = require('express');
const Room = require('../models/Room');
const auth = require('../middleware/auth'); // Middleware xác thực JWT
const router = express.Router();

// Tạo phòng (thay đổi: yêu cầu auth)
router.post('/', auth, async (req, res) => {
  try {
    const room = new Room({ ...req.body, creator: req.user.id });
    await room.save();
    res.status(201).json(room);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Lấy danh sách phòng (thay đổi: populate players)
router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find().populate('players', 'username');
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// Tham gia phòng (thay đổi: emit socket event)
router.post('/:id/join', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room || room.players.length >= room.maxPlayers) return res.status(400).json({ error: 'Room full' });
    
    room.players.push(req.user.id);
    await room.save();
    // Emit socket (giả định io được import từ socketServer)
    const io = require('../socketServer').io; // Cần export io từ socketServer
    io.to(req.params.id).emit('player_joined', req.user.id);
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: 'Failed to join' });
  }
});

module.exports = router;