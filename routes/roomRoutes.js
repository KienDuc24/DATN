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
    if (!player || !game) {
      return res.status(400).json({ error: 'player and game are required' });
    }

    // Find or create host user
    let hostUser = await User.findOne({ username: player }).exec();
    if (!hostUser) {
      try {
        hostUser = await User.create({ username: player, displayName: player, role: role || 'player' });
      } catch (err) {
        console.error('[roomRoutes] Failed to create user:', err.message);
        return res.status(500).json({ error: 'Failed to create user' });
      }
    }

    // Create room
    const room = new Room({
      host: hostUser._id || hostUser,
      players: [{ name: hostUser.displayName || hostUser.username || player }],
      game: { gameId: String(game), type: gameType ? String(gameType) : String(game) }
    });

    try {
      await room.save();
    } catch (err) {
      console.error('[roomRoutes] Failed to create room:', err.message);
      return res.status(500).json({ error: 'Failed to create room' });
    }

    return res.status(201).json({
      roomCode: room.code,
      room: { id: room._id, code: room.code, game: room.game, players: room.players, status: room.status }
    });
  } catch (err) {
    console.error('[roomRoutes] Unexpected error:', err.message);
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

    if (!room.players.includes(player)) {
      room.players.push(player);
      await room.save();
    }

    return res.json({ success: true, room: { id: room._id, code: room.code, players: room.players, game: room.game } });
  } catch (err) {
    console.error('[roomRoutes] join room error', err && (err.stack || err.message));
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * Get room info
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

    const room = await Room.findOne({ code, 'game.gameId': gameId }).exec();
    if (!room) {
      return res.status(404).json({ error: 'Room not found or game mismatch' });
    }

    return res.json({
      found: true,
      room: {
        id: room._id,
        code: room.code,
        players: room.players,
        game: room.game,
        status: room.status
      }
    });
  } catch (err) {
    console.error('[roomRoutes] get room error', err && (err.stack || err.message));
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;