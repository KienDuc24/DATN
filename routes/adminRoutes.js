// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Room = require('../models/Room');
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
    const users = await User.find().select('-password');
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
    const rooms = await Room.find();
    res.json({ rooms });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.delete('/room/:id', async (req, res) => {
  try {
    await Room.findOneAndDelete({ code: req.params.id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

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

// --- SỬA LỖI LOGIC "NỔI BẬT" ---
router.put('/games/:id', (req, res) => {
  try {
    let games = readGames();
    const gameId = req.params.id;
    const updates = req.body; // Dữ liệu update (ví dụ: { featured: true } hoặc cả object)

    const gameIndex = games.findIndex(g => g.id === gameId);
    
    if (gameIndex === -1) {
      return res.status(404).json({ message: 'Game not found' });
    }

    // Trộn (merge) dữ liệu cũ với dữ liệu mới
    // Bằng cách này, nếu bạn chỉ gửi { featured: true },
    // nó sẽ giữ lại 'name', 'desc' v.v.
    const originalGame = games[gameIndex];
    const updatedGame = { ...originalGame, ...updates };

    // Nếu ID bị thay đổi trong payload, xử lý phức tạp hơn:
    if (updates.id && updates.id !== gameId) {
        // Xóa game cũ (theo ID cũ)
        games = games.filter(g => g.id !== gameId);
        // Thêm game mới (với ID mới)
        games.push(updatedGame);
    } else {
        // Chỉ cập nhật game
        games[gameIndex] = updatedGame;
    }
    
    writeGames(games);
    res.json(updatedGame);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});
// --- HẾT SỬA LỖI ---

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