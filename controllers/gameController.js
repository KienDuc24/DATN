// controllers/gameController.js (File mới)

const Game = require('../models/Game');

exports.getAllPublicGames = async (req, res) => {
  try {
    const games = await Game.find({});
    res.json(games);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};