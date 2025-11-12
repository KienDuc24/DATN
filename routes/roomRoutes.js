const express = require('express');
const mongoose = require('mongoose');
const Room = require('../models/Room');
const User = require('../models/User');

const router = express.Router();

router.use((req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    console.error('[roomRoutes] Database not ready');
    return res.status(503).json({ error: 'Database not ready' });
  }
  next();
});

router.post('/', async (req, res) => {
  const { player, game, gameType, role } = req.body;

  if (!player || !game || !gameType || !role) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  const newRoom = new Room({
    code: roomCode,
    host: player,
    players: [{ name: player }],
    game: { gameId: game, type: gameType }
  });

  try {
    await newRoom.save();
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
    console.error('[server] Error creating room:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', async (req, res) => {
  const { code, gameId } = req.query;

  if (!code || !gameId) {
    return res.status(400).json({ error: 'code and gameId are required' });
  }

  try {
    const room = await Room.findOne({ code, 'game.gameId': gameId });
    if (!room) {
      return res.status(404).json({ found: false, message: 'Room not found' });
    }

    return res.status(200).json({ found: true, room });
  } catch (err) {
    console.error('[server] Error fetching room:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/join', async (req, res, next) => {
  try {
    const { player, code, gameId } = req.body || {};
    if (!player || !code || !gameId) {
      return res.status(400).json({ error: 'player, code, and gameId are required' });
    }

    const room = await Room.findOneAndUpdate(
      { code, 'game.gameId': gameId },
      { $addToSet: { players: { name: player } } },
      { new: true }
    ).select('code game players');

    if (!room) {
      return res.status(404).json({ error: 'Room not found or game mismatch' });
    }

    return res.json({
      success: true,
      room: {
        id: room._id,
        code: room.code,
        players: room.players.map(p => p.name),
        game: room.game
      }
    });
  } catch (err) {
    next(err);
  }
});

router.use((err, req, res, next) => {
  console.error('[roomRoutes] Unexpected error:', err.message);
  res.status(500).json({ error: 'Internal Server Error' });
});

module.exports = router;