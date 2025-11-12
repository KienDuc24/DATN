// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Room = require('../models/Room');
const fs = require('fs');
const path = require('path');

const gamesFilePath = path.join(__dirname, '../public/games.json');

// (Giữ nguyên các hàm helper readGames/writeGames)
function readGames() {
  try { const data = fs.readFileSync(gamesFilePath, 'utf8'); return JSON.parse(data); } 
  catch (e) { console.error('Error reading games.json:', e); return []; }
}
function writeGames(data) {
  try { fs.writeFileSync(gamesFilePath, JSON.stringify(data, null, 2), 'utf8'); } 
  catch (e) { console.error('Error writing games.json:', e); }
}

// SỬA: Bọc router trong một hàm để nhận 'io'
module.exports = function(io) {
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
      io.emit('admin-users-changed'); // THÊM MỚI
      res.json(updatedUser);
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  });

  router.delete('/user/:id', async (req, res) => {
    try {
      await User.findByIdAndDelete(req.params.id);
      io.emit('admin-users-changed'); // THÊM MỚI
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

  // SỬA: Thêm logic Kick
  router.delete('/room/:id', async (req, res) => {
    try {
      const roomCode = req.params.id;
      
      // THÊM MỚI: Gửi sự kiện kick
      console.log(`[Admin] Admin kicking all players from room ${roomCode}`);
      io.to(roomCode).emit('kicked', { message: 'Phòng đã bị Admin đóng.' });
      // HẾT THÊM MỚI
      
      await Room.findOneAndDelete({ code: roomCode });
      io.emit('admin-rooms-changed'); // THÊM MỚI
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
      io.emit('admin-games-changed'); // THÊM MỚI
      res.status(201).json(newGame);
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  });

  router.put('/games/:id', (req, res) => {
    try {
      let games = readGames();
      const gameId = req.params.id;
      const updates = req.body; 
      const gameIndex = games.findIndex(g => g.id === gameId);
      if (gameIndex === -1) {
        return res.status(404).json({ message: 'Game not found' });
      }
      const originalGame = games[gameIndex];
      const updatedGame = { ...originalGame, ...updates }; // Trộn
      if (updates.id && updates.id !== gameId) {
          games = games.filter(g => g.id !== gameId);
          games.push(updatedGame);
      } else {
          games[gameIndex] = updatedGame;
      }
      writeGames(games);
      io.emit('admin-games-changed'); // THÊM MỚI
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
      io.emit('admin-games-changed'); // THÊM MỚI
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  });

  return router; // Trả về router
};