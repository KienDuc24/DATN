// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Room = require('../models/Room');
const Game = require('../models/Game'); // <-- THÊM MỚI: Import Game model

// SỬA: Bọc router trong một hàm để nhận 'io'
module.exports = function(io) {
  // --- API NGƯỜI DÙNG (USERS) ---
  // (Phần này giữ nguyên, đã đúng)
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
      io.emit('admin-users-changed'); 
      res.json(updatedUser);
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  });

  router.delete('/user/:id', async (req, res) => {
    try {
      await User.findByIdAndDelete(req.params.id);
      io.emit('admin-users-changed'); 
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  });

  // --- API PHÒNG CHƠI (ROOMS) ---
  // (Phần này giữ nguyên, đã đúng)
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
      const roomCode = req.params.id;
      
      console.log(`[Admin] Admin kicking all players from room ${roomCode}`);
      io.to(roomCode).emit('kicked', { message: 'Phòng đã bị Admin đóng.' });
      
      await Room.findOneAndDelete({ code: roomCode });
      io.emit('admin-rooms-changed'); 
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  });

  // --- API TRÒ CHƠI (GAMES) - ĐÃ SỬA ĐỂ DÙNG DATABASE ---
  
  // SỬA: Lấy game từ database
  router.get('/games', async (req, res) => {
    try {
        const games = await Game.find({});
        res.json({ games });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
  });

  // SỬA: Thêm game mới vào database
  router.post('/games', async (req, res) => {
    try {
      const newGame = new Game(req.body);
      await newGame.save();
      io.emit('admin-games-changed'); 
      res.status(201).json(newGame);
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  });

  // SỬA: Cập nhật game trong database (dùng 'id' string)
  router.put('/games/:id', async (req, res) => {
    try {
      const gameId = req.params.id; // Đây là 'id' string (ví dụ: "Draw")
      const updates = req.body; 
      
      // Tìm bằng 'id' string và cập nhật
      const updatedGame = await Game.findOneAndUpdate({ id: gameId }, updates, { new: true });

      if (!updatedGame) {
        return res.status(404).json({ message: 'Game not found with that ID string' });
      }

      io.emit('admin-games-changed');
      res.json(updatedGame);
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  });

  // SỬA: Xóa game khỏi database (dùng 'id' string)
  router.delete('/games/:id', async (req, res) => {
    try {
      const gameId = req.params.id; // Đây là 'id' string
      const deletedGame = await Game.findOneAndDelete({ id: gameId });

      if (!deletedGame) {
           return res.status(404).json({ message: 'Game not found with that ID string' });
      }

      io.emit('admin-games-changed');
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  });

  // --- THÊM MỚI: ROUTE ĐỂ ĐỒNG BỘ (SYNC) TỪ games.json ---
  router.post('/games/sync', async (req, res) => {
        const gamesData = req.body; // Dữ liệu này được gửi từ admin.js

        if (!Array.isArray(gamesData)) {
            return res.status(400).json({ message: 'Dữ liệu gửi lên không phải là một mảng (array).' });
        }

        try {
            // 1. Xóa tất cả game hiện có trong database
            await Game.deleteMany({});
            console.log('[Admin Sync] Đã xóa toàn bộ game cũ.');

            // 2. Thêm dữ liệu game mới từ mảng vừa nhận được
            const newGames = await Game.insertMany(gamesData);
            console.log(`[Admin Sync] Đã thêm ${newGames.length} game mới.`);

            // 3. Gửi socket event để thông báo cho các admin client
            io.emit('admin-games-changed');

            // 4. Trả về thành công
            res.status(201).json({ 
                message: `Đồng bộ thành công! Đã xóa game cũ và thêm ${newGames.length} game mới.`,
                count: newGames.length 
            });

        } catch (error) {
            console.error('Lỗi khi đồng bộ /api/admin/games/sync:', error);
            res.status(500).json({ message: 'Lỗi máy chủ khi đồng bộ game.', error: error.message });
        }
    });
  // --- KẾT THÚC ROUTE MỚI ---

  return router; // Trả về router
};