const express = require('express');
const mongoose = require('mongoose');
const Room = require('../models/Room');
const User = require('../models/User');

const router = express.Router();

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

    return res.status(201).json({
      roomCode: room.code,
      room: { id: room._id, code: room.code, game: room.game, players: room.players, status: room.status }
    });
  } catch (err) {
    console.error('[roomRoutes] create room error', err && (err.stack || err.message));
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * Join room
 * Body: { player, code, gameId }
 */
router.post('/join', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database not ready' });
  }

  try {
    const { player, code, gameId } = req.body || {};
    if (!player || !code || !gameId) return res.status(400).json({ error: 'player, code, and gameId are required' });

    const room = await Room.findOne({ code, 'game.gameId': gameId }).exec();
    if (!room) return res.status(404).json({ error: 'Room not found or game mismatch' });

    let user = await User.findOne({ username: player }).exec();
    if (!user) {
      try {
        user = await User.create({ username: player, displayName: player });
      } catch (e) {
        user = await User.findOne({ username: player }).exec();
        if (!user) user = { _id: mongoose.Types.ObjectId(), username: player, displayName: player };
      }
    }

    const name = user.displayName || user.username || player;
    const exists = (room.players || []).some(p => p.name === name);
    if (!exists) {
      room.players.push({ name });
      await room.save();
    }

    return res.json({ success: true, room: { id: room._id, code: room.code, players: room.players, game: room.game } });
  } catch (err) {
    console.error('[roomRoutes] join room error', err && (err.stack || err.message));
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * Check room by code and gameId
 * Query: ?code=...&gameId=...
 */
router.get('/', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database not ready' });
  }

  try {
    const { code, gameId } = req.query;
    if (!code || !gameId) {
      return res.status(400).json({ error: 'code and gameId are required' });
    }

    const room = await Room.findOne({ code, 'game.gameId': gameId }).populate('host', 'username displayName').exec();
    if (!room) {
      return res.status(404).json({ error: 'Room not found or game mismatch' });
    }

    return res.json({
      found: true,
      room: {
        id: room._id,
        code: room.code,
        host: room.host,
        players: room.players,
        game: room.game,
        status: room.status,
        createdAt: room.createdAt
      }
    });
  } catch (err) {
    console.error('[roomRoutes] get room error', err && (err.stack || err.message));
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;