// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Room = require('../models/Room');
const Game = require('../models/Game'); // Import Game model

// Bọc router trong một hàm để nhận 'io'
module.exports = function(io) {
  // --- API NGƯỜI DÙNG (USERS) ---
  // (Phần này giữ nguyên)
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
  // (Phần này giữ nguyên)
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

  // --- API TRÒ CHƠI (GAMES) ---
  // (Phần này giữ nguyên)
  router.get('/games', async (req, res) => {
    try {
        const games = await Game.find({});
        res.json({ games });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
  });

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

  router.put('/games/:id', async (req, res) => {
    try {
      const gameId = req.params.id; 
      const updates = req.body; 
      
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

  router.delete('/games/:id', async (req, res) => {
    try {
      const gameId = req.params.id; 
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

  // --- SỬA ĐỔI LOGIC SYNC: Thay thế "Xóa/Tạo" bằng "Cập nhật/Tạo" ---
  router.post('/games/sync', async (req, res) => {
        const gamesData = req.body; // Dữ liệu này được gửi từ admin.js

        if (!Array.isArray(gamesData)) {
            return res.status(400).json({ message: 'Dữ liệu gửi lên không phải là một mảng (array).' });
        }

        let updatedCount = 0;
        let createdCount = 0;

        try {
            // Lặp qua từng game trong tệp games.json
            for (const game of gamesData) {
                if (!game.id) {
                    console.warn('[AdminSync] Bỏ qua game không có ID:', game.name);
                    continue; // Bỏ qua nếu game không có ID
                }

                // Logic "Upsert":
                // Tìm một game bằng 'id' string.
                const existingGame = await Game.findOne({ id: game.id });

                if (existingGame) {
                    // 1. Đã tồn tại -> Cập nhật (update)
                    // (Chúng ta dùng updateOne để cập nhật nội dung mà không thay đổi _id của Mongoose)
                    await Game.updateOne(
                        { id: game.id }, // Điều kiện tìm
                        game,            // Dữ liệu mới
                        { runValidators: true } // Chạy kiểm tra schema
                    );
                    updatedCount++;
                } else {
                    // 2. Chưa tồn tại -> Tạo mới (insert)
                    await Game.create(game);
                    createdCount++;
                }
            }
            
            console.log(`[Admin Sync] Đồng bộ hoàn tất. Đã cập nhật ${updatedCount} và tạo mới ${createdCount} game.`);
            
            // Gửi thông báo socket tới TẤT CẢ admin đang kết nối
            io.emit('admin-games-changed'); //

            // Trả về kết quả
            res.json({ 
                message: `Đồng bộ (Upsert) hoàn tất!`, 
                updated: updatedCount, 
                created: createdCount 
            });

        } catch (error) {
            console.error('Lỗi khi đồng bộ /api/admin/games/sync:', error);
            res.status(500).json({ message: 'Lỗi máy chủ khi đồng bộ game.', error: error.message });
        }
    });
  // --- KẾT THÚC ROUTE ĐÃ SỬA ---

  return router; // Trả về router
};