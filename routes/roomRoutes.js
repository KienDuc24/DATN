const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const auth = require('../middleware/auth');
const { getIO } = require('../socketServer');

router.post('/', auth, async (req, res) => {
  try {
    const { name, gameType, maxPlayers } = req.body;
    if (!name || !gameType) return res.status(400).json({ error: 'name and gameType required' });

    const room = new Room({ name, gameType, maxPlayers: maxPlayers || 4, host: req.user._id, players: [req.user._id] });
    await room.save();

    const io = getIO();
    if (io) io.emit('room_created', { roomId: room._id.toString(), name: room.name });
    else console.log('[roomRoutes] io not initialized yet - room_created not emitted');

    return res.status(201).json(room);
  } catch (err) {
    console.error('[roomRoutes] create error', err && err.stack || err);
    return res.status(500).json({ error: 'Failed to create room' });
  }
});

module.exports = router;