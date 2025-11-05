const express = require('express');
const mongoose = require('mongoose');
const Room = require('../models/Room');
const User = require('../models/User');

const router = express.Router();

router.post('/', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    console.warn('[roomRoutes] DB not connected, readyState=', mongoose.connection.readyState);
    return res.status(503).json({ error: 'Database not ready, try again shortly' });
  }

  console.log('[roomRoutes] POST /api/room body=', JSON.stringify(req.body));
  try {
    const { player, game, gameType } = req.body || {};
    if (!player || !game) return res.status(400).json({ error: 'player and game are required' });

    let hostUser = await User.findOne({ username: player }).exec();
    if (!hostUser) {
      try {
        // try to create persisted guest user
        hostUser = new User({ username: player, displayName: player });
        await hostUser.save();
        console.log('[roomRoutes] created guest user', hostUser._id);
      } catch (e) {
        // if User creation fails (validation), fallback to temporary host id so room creation can continue
        console.warn('[roomRoutes] create user failed, using temporary host:', e && (e.message || e));
        const tempId = mongoose.Types.ObjectId();
        hostUser = { _id: tempId, username: player, displayName: player };
      }
    }
    
    // build room according to models/Room.js
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
      room: { id: room._id, game: room.game, players: room.players, status: room.status }
    });
  } catch (err) {
    console.error('[roomRoutes] create room error', err && (err.stack || err.message));
    if (process.env.DEBUG === 'true') return res.status(500).json({ error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    console.warn('[roomRoutes] DB not connected (GET), readyState=', mongoose.connection.readyState);
    return res.status(503).json({ error: 'Database not ready, try again shortly' });
  }

  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'code query required' });

    let room = null;
    if (mongoose.Types.ObjectId.isValid(code)) {
      room = await Room.findById(code).populate('host', 'username displayName').exec();
    }
    if (!room) room = await Room.findOne({ code }).populate('host', 'username displayName').exec();
    if (!room) return res.status(404).json({ found: false });

    return res.json({
      found: true,
      room: { id: room._id, host: room.host, players: room.players, game: room.game, status: room.status, createdAt: room.createdAt }
    });
  } catch (err) {
    console.error('[roomRoutes] get room error', err && (err.stack || err.message));
    if (process.env.DEBUG === 'true') return res.status(500).json({ error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;