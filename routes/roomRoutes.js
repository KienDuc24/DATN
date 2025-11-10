const express = require('express');
const mongoose = require('mongoose');
const Room = require('../models/Room');
const User = require('../models/User');

const router = express.Router();

/**
 * API tạo phòng
 * Body: { player, game, gameType, role? }
 */
router.post('/', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    console.error('[roomRoutes] Database not ready');
    return res.status(503).json({ error: 'Database not ready' });
  }

  try {
    const { player, game, gameType, role } = req.body || {};
    if (!player || !game) {
      console.error('[roomRoutes] Missing player or game');
      return res.status(400).json({ error: 'player and game are required' });
    }

    let hostUser = await User.findOne({ username: player }).exec();
    if (!hostUser) {
      try {
        hostUser = await User.create({ username: player, displayName: player, role: role || 'player' });
      } catch (err) {
        console.error('[roomRoutes] Failed to create user:', err.message);
        return res.status(500).json({ error: 'Failed to create user' });
      }
    }

    const room = new Room({
      host: hostUser._id || hostUser,
      players: [{ name: hostUser.displayName || hostUser.username || player }],
      game: { gameId: String(game), type: gameType ? String(gameType) : String(game) }
    });

    try {
      await room.save();
      console.log('[roomRoutes] Room created:', {
        code: room.code,
        game: room.game,
        players: room.players.map(p => p.name)
      });
    } catch (err) {
      console.error('[roomRoutes] Failed to create room:', err.message);
      return res.status(500).json({ error: 'Failed to create room' });
    }

    return res.status(201).json({
      roomCode: room.code,
      room: {
        id: room._id,
        code: room.code,
        game: room.game,
        players: room.players.map(p => p.name),
        status: room.status
      }
    });
  } catch (err) {
    console.error('[roomRoutes] Unexpected error:', err.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * API kiểm tra phòng
 * Query: ?code=...&gameId=...
 */
router.get('/', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    console.error('[roomRoutes] Database not ready');
    return res.status(503).json({ error: 'Database not ready' });
  }

  try {
    const { code, gameId } = req.query;

    if (!code || !gameId) {
      console.error('[roomRoutes] Missing code or gameId:', { code, gameId });
      return res.status(400).json({ error: 'code and gameId are required' });
    }

    const room = await Room.findOne({ code, 'game.gameId': gameId }).exec();
    if (!room) {
      console.error('[roomRoutes] Room not found:', { code, gameId });
      return res.status(404).json({ error: 'Room not found or game mismatch' });
    }

    return res.json({
      found: true,
      room: {
        id: room._id,
        code: room.code,
        players: room.players.map(p => p.name),
        game: room.game,
        status: room.status
      }
    });
  } catch (err) {
    console.error('[roomRoutes] Unexpected error:', err.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * API tham gia phòng
 * Body: { player, code, gameId }
 */
router.post('/join', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database not ready' });
  }

  try {
    const { player, code, gameId } = req.body || {};
    if (!player || !code || !gameId) {
      return res.status(400).json({ error: 'player, code, and gameId are required' });
    }

    const room = await Room.findOne({ code, 'game.gameId': gameId }).exec();
    if (!room) {
      return res.status(404).json({ error: 'Room not found or game mismatch' });
    }

    if (!room.players.some(p => p.name === player)) {
      room.players.push({ name: player });
      await room.save();
    }

    return res.json({ success: true, room: { id: room._id, code: room.code, players: room.players.map(p => p.name), game: room.game } });
  } catch (err) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;