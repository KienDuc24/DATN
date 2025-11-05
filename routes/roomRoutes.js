const express = require('express');
const mongoose = require('mongoose');
const Room = require('../models/Room');
const User = require('../models/User');

const router = express.Router();

function isObjectId(val) {
  return mongoose.Types.ObjectId.isValid(val);
}

async function appendPlayHistory(user, entry) {
  if (!user) return;
  try {
    if (typeof user.save === 'function') {
      user.playHistory = user.playHistory || [];
      user.playHistory.unshift(entry);
      if (user.playHistory.length > 100) user.playHistory = user.playHistory.slice(0, 100);
      await user.save();
    }
  } catch (e) {
    console.warn('[roomRoutes] appendPlayHistory failed', e && e.message);
  }
}

/**
 * Create room
 * Body: { player, game, gameType, role? }
 */
router.post('/', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database not ready' });
  }

  try {
    const { player, game, gameType, role } = req.body || {};
    if (!player || !game) return res.status(400).json({ error: 'player and game are required' });

    // find/create user
    let hostUser = await User.findOne({ username: player }).exec();
    if (!hostUser) {
      try {
        hostUser = await User.create({ username: player, displayName: player, role: role || 'player' });
      } catch (e) {
        hostUser = await User.findOne({ username: player }).exec();
        if (!hostUser) hostUser = { _id: mongoose.Types.ObjectId(), username: player, displayName: player, role: role || 'player' };
      }
    }

    const room = new Room({
      host: hostUser._id || hostUser,
      players: [{ name: hostUser.displayName || hostUser.username || player }],
      game: { gameId: String(game), type: gameType ? String(gameType) : String(game) }
    });

    await room.save();

    // record history
    await appendPlayHistory(hostUser, {
      gameId: String(game),
      gameName: gameType || String(game),
      action: 'created_room',
      playedAt: new Date()
    });

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

/**
 * Join room
 * Body: { player, code }
 */
router.post('/join', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database not ready' });
  }

  try {
    const { player, code } = req.body || {};
    if (!player || !code) return res.status(400).json({ error: 'player and code are required' });

    // find room by id or custom code
    let room = null;
    if (isObjectId(code)) room = await Room.findById(code).exec();
    if (!room) room = await Room.findOne({ code }).exec();
    if (!room) return res.status(404).json({ error: 'Room not found' });

    // find/create user
    let user = await User.findOne({ username: player }).exec();
    if (!user) {
      try {
        user = await User.create({ username: player, displayName: player });
      } catch (e) {
        user = await User.findOne({ username: player }).exec();
        if (!user) user = { _id: mongoose.Types.ObjectId(), username: player, displayName: player };
      }
    }

    // add player to room if not exists
    const name = user.displayName || user.username || player;
    const exists = (room.players || []).some(p => {
      if (!p) return false;
      if (typeof p === 'string') return p === name;
      return (p.name || p.username || '').toString() === name.toString();
    });
    if (!exists) {
      room.players = room.players || [];
      room.players.push({ name });
      await room.save();
    }

    // record join history
    await appendPlayHistory(user, {
      gameId: room.game?.gameId || '',
      gameName: room.game?.type || '',
      action: 'joined_room',
      playedAt: new Date()
    });

    return res.json({ success: true, room: { id: room._id, players: room.players, game: room.game } });
  } catch (err) {
    console.error('[roomRoutes] join room error', err && (err.stack || err.message));
    if (process.env.DEBUG === 'true') return res.status(500).json({ error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * Leave room
 * Body: { player, code }
 */
router.post('/leave', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database not ready' });
  }

  try {
    const { player, code } = req.body || {};
    if (!player || !code) return res.status(400).json({ error: 'player and code are required' });

    let room = null;
    if (isObjectId(code)) room = await Room.findById(code).exec();
    if (!room) room = await Room.findOne({ code }).exec();
    if (!room) return res.status(404).json({ error: 'Room not found' });

    // remove player from room.players
    room.players = (room.players || []).filter(p => {
      const name = (p && (p.name || p.username)) || p;
      return name !== player;
    });
    await room.save();

    // record leave history if user persisted
    const user = await User.findOne({ username: player }).exec();
    if (user) {
      await appendPlayHistory(user, {
        gameId: room.game?.gameId || '',
        gameName: room.game?.type || '',
        action: 'left_room',
        playedAt: new Date()
      });
    }

    return res.json({ success: true, room: { id: room._id, players: room.players } });
  } catch (err) {
    console.error('[roomRoutes] leave room error', err && (err.stack || err.message));
    if (process.env.DEBUG === 'true') return res.status(500).json({ error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * Check room by code (id or custom code)
 * Query: ?code=...
 */
router.get('/', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database not ready' });
  }

  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'code query required' });

    let room = null;
    if (isObjectId(code)) {
      room = await Room.findById(code).populate('host', 'username displayName').exec();
    }
    if (!room) room = await Room.findOne({ code }).populate('host', 'username displayName').exec();
    if (!room) return res.status(404).json({ found: false });

    return res.json({
      found: true,
      room: {
        id: room._id,
        host: room.host,
        players: room.players,
        game: room.game,
        status: room.status,
        createdAt: room.createdAt
      }
    });
  } catch (err) {
    console.error('[roomRoutes] get room error', err && (err.stack || err.message));
    if (process.env.DEBUG === 'true') return res.status(500).json({ error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;