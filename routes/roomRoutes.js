const express = require('express');
const mongoose = require('mongoose');
const Room = require('../models/Room');
const User = require('../models/User');

const router = express.Router();

/**
 * API tạo phòng
 * Body: { player, game, gameType, role? }
 */
router.post('/room', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    console.error('[roomRoutes] Database not ready');
    return res.status(503).json({ error: 'Database not ready' });
  }

  try {
    const { player, game, gameType, role } = req.body || {};
    if (!player || !game || !gameType || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
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

    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newRoom = new Room({
      code: roomCode,
      host: hostUser._id || hostUser,
      players: [{ name: hostUser.displayName || hostUser.username || player }],
      game: { gameId: String(game), type: gameType ? String(gameType) : String(game) }
    });

    try {
      await newRoom.save();
      console.log('[roomRoutes] Room created:', {
        code: newRoom.code,
        game: newRoom.game,
        players: newRoom.players.map(p => p.name)
      });
    } catch (err) {
      console.error('[roomRoutes] Failed to create room:', err.message);
      return res.status(500).json({ error: 'Failed to create room' });
    }

    return res.status(201).json({
      roomCode: newRoom.code,
      room: {
        id: newRoom._id,
        code: newRoom.code,
        game: newRoom.game,
        players: newRoom.players.map(p => p.name),
        status: newRoom.status
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