const express = require('express');
const mongoose = require('mongoose');
const Room = require('../models/Room');
const User = require('../models/User');

const router = express.Router();

// Create room
router.post('/', async (req, res) => {
  console.log('[roomRoutes] POST /api/room body=', JSON.stringify(req.body));
  try {
    const { player, game, gameType } = req.body || {};
    if (!player || !game) {
      return res.status(400).json({ error: 'player and game are required' });
    }

    // find or create host user
    let hostUser = await User.findOne({ username: player });
    if (!hostUser) {
      hostUser = new User({ username: player, displayName: player });
      await hostUser.save();
      console.log('[roomRoutes] created guest user', hostUser._id);
    }

    const room = new Room({
      host: hostUser._id,
      players: [{ name: hostUser.displayName || hostUser.username || player }],
      game: {
        gameId: String(game),
        type: gameType ? String(gameType) : String(game)
      }
    });

    await room.save();

    return res.status(201).json({
      roomCode: String(room._id),
      room: {
        id: room._id,
        game: room.game,
        players: room.players,
        status: room.status
      }
    });
  } catch (err) {
    console.error('[roomRoutes] create room error', err && (err.stack || err.message));
    return res.status(500).json({
      error: 'Internal Server Error',
      ...(process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {})
    });
  }
});

// Check room by code (id) or custom code
router.get('/', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'code query required' });

    let room = null;
    if (mongoose.Types.ObjectId.isValid(code)) {
      room = await Room.findById(code).populate('host', 'username displayName');
    }

    if (!room) {
      room = await Room.findOne({ code }).populate('host', 'username displayName');
    }

    if (!room) return res.status(404).json({ found: false });

    return res.json({
      found: true,
      room: {
        id: room._id,
        host: room.host,
        players: room.players,
        game: room.game,
        status: room.status
      }
    });
  } catch (err) {
    console.error('[roomRoutes] get room error', err && (err.stack || err.message));
    return res.status(500).json({
      error: 'Internal Server Error',
      ...(process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {})
    });
  }
});

module.exports = router;