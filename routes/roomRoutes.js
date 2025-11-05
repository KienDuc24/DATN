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
        players: room.players
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
        players: room.players,
        status: room.status
      }
    });
  } catch (err) {
    console.error('[roomRoutes] Unexpected error:', err.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * Check room by code and gameId
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
      console.error('[roomRoutes] Missing code or gameId');
      return res.status(400).json({ error: 'code and gameId are required' });
    }

    const room = await Room.findOne({ code, 'game.gameId': gameId }).exec();
    if (!room) {
      console.error('[roomRoutes] Room not found:', { code, gameId });
      return res.status(404).json({ error: 'Room not found or game mismatch' });
    }

    // Cập nhật danh sách người chơi nếu cần
    const updatedPlayers = room.players.map(p => p.name);
    console.log('[roomRoutes] Room found:', {
      code: room.code,
      game: room.game,
      players: updatedPlayers
    });

    return res.json({
      found: true,
      room: {
        id: room._id,
        code: room.code,
        players: updatedPlayers,
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
 * Join room
 * Body: { player, code, gameId }
 */
router.post('/join', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    console.error('[roomRoutes] Database not ready');
    return res.status(503).json({ error: 'Database not ready' });
  }

  try {
    const { player, code, gameId } = req.body || {};
    if (!player || !code || !gameId) {
      console.error('[roomRoutes] Missing player, code, or gameId');
      return res.status(400).json({ error: 'player, code, and gameId are required' });
    }

    const room = await Room.findOne({ code, 'game.gameId': gameId }).exec();
    if (!room) {
      console.error('[roomRoutes] Room not found or game mismatch:', { code, gameId });
      return res.status(404).json({ error: 'Room not found or game mismatch' });
    }

    // Kiểm tra người chơi đã có trong phòng chưa
    const playerExists = room.players.some(p => p.name === player);
    if (!playerExists) {
      room.players.push({ name: player });
      await room.save();
      console.log('[roomRoutes] Player joined room:', { player, room: room.code });
    } else {
      console.log('[roomRoutes] Player already in room:', { player, room: room.code });
    }

    return res.json({ success: true, room: { id: room._id, code: room.code, players: room.players, game: room.game } });
  } catch (err) {
    console.error('[roomRoutes] join room error:', err.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;