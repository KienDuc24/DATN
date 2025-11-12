// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Import model User
const Room = require('../models/Room'); // Import model Room
const fs = require('fs');
const path = require('path');

const gamesFilePath = path.join(__dirname, '../public/games.json');

// --- Helpers đọc/ghi file games.json ---
function readGames() {
  try {
    const data = fs.readFileSync(gamesFilePath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error('Error reading games.json:', e);
    return [];
  }
}
function writeGames(data) {
  try {
    fs.writeFileSync(gamesFilePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing games.json:', e);
  }
}

// --- API NGƯỜI DÙNG (USERS) ---
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password'); // Lấy tất cả user, trừ password
    res.json({ users });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.put('/user/:id', async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
    res.json(updatedUser);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.delete('/user/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// --- API PHÒNG CHƠI (ROOMS) ---
router.get('/rooms', async (req, res) => {
  try {
    const rooms = await Room.find(); // Lấy tất cả phòng
    res.json({ rooms });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.delete('/room/:id', async (req, res) => {
  try {
    // Room dùng 'code' làm ID
    await Room.findOneAndDelete({ code: req.params.id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});
// (Bạn có thể thêm PUT/POST cho Room nếu cần)

// --- API TRÒ CHƠI (GAMES) ---
router.get('/games', (req, res) => {
  const games = readGames();
  res.json({ games });
});

router.post('/games', (req, res) => {
  try {
    const games = readGames();
    const newGame = req.body;
    games.push(newGame);
    writeGames(games);
    res.status(201).json(newGame);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.put('/games/:id', (req, res) => {
  try {
    let games = readGames();
    const gameId = req.params.id;
    const updatedGame = req.body;
    
    // Nếu ID bị thay đổi, xóa cái cũ
    if (gameId !== updatedGame.id) {
        games = games.filter(g => g.id !== gameId);
    }
    
    // Cập nhật hoặc thêm mới
    const index = games.findIndex(g => g.id === updatedGame.id);
    if (index > -1) {
      games[index] = updatedGame;
    } else {
      games.push(updatedGame);
    }
    
    writeGames(games);
    res.json(updatedGame);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.delete('/games/:id', (req, res) => {
  try {
    let games = readGames();
    games = games.filter(g => g.id !== req.params.id);
    writeGames(games);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;