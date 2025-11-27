const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

router.get('/', (req, res) => {
  try {
    const games = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/games.json'), 'utf8'));
    res.json(games);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load games' });
  }
});

router.post('/:gameId/start/:roomId', async (req, res) => {
  try {
    const Room = require('../models/Room');
    await Room.findByIdAndUpdate(req.params.roomId, { gameType: req.params.gameId, isActive: true });
    res.json({ message: 'Game started' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start game' });
  }
});

module.exports = router;