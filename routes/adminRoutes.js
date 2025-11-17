// routes/adminRoutes.js (ĐÃ SỬA)
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController'); // <-- Import controller

module.exports = function(io) {

  // --- API NGƯỜI DÙNG (USERS) ---
  router.get('/users', async (req, res) => {
    try {
      const users = await adminController.getAllUsers();
      res.json({ users });
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  });

  router.put('/users/:id', async (req, res) => { // Sửa: Thêm /users/
    try {
      const updatedUser = await adminController.updateUser(req.params.id, req.body);
      io.emit('admin-users-changed'); 
      res.json(updatedUser);
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  });

  router.delete('/users/:id', async (req, res) => { // Sửa: Thêm /users/
    try {
      await adminController.deleteUser(req.params.id);
      io.emit('admin-users-changed'); 
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  });

  // --- API PHÒNG CHƠI (ROOMS) ---
  router.get('/rooms', async (req, res) => {
    try {
      const rooms = await adminController.getAllRooms();
      res.json({ rooms });
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  });

  router.delete('/rooms/:id', async (req, res) => { // Sửa: Thêm /rooms/
    try {
      const roomCode = req.params.id;

      console.log(`[Admin] Admin kicking all players from room ${roomCode}`);
      io.to(roomCode).emit('kicked', { message: 'Phòng đã bị Admin đóng.' });

      await adminController.deleteRoom(roomCode);
      io.emit('admin-rooms-changed'); 
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  });

  // --- API TRÒ CHƠI (GAMES) ---
  router.get('/games', async (req, res) => {
    try {
        const games = await adminController.getAllGames();
        res.json({ games });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
  });

  router.post('/games', async (req, res) => {
    try {
      const newGame = await adminController.createGame(req.body);
      io.emit('admin-games-changed'); 
      res.status(201).json(newGame);
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  });

  router.put('/games/:id', async (req, res) => {
    try {
      const updatedGame = await adminController.updateGame(req.params.id, req.body);
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
      const deletedGame = await adminController.deleteGame(req.params.id);
      if (!deletedGame) {
         return res.status(404).json({ message: 'Game not found with that ID string' });
      }
      io.emit('admin-games-changed');
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  });

  router.post('/games/sync', async (req, res) => {
        try {
            const result = await adminController.syncGames(req.body);

            console.log(`[Admin Sync] Đồng bộ hoàn tất. Đã cập nhật ${result.updated} và tạo mới ${result.created} game.`);
            io.emit('admin-games-changed'); 
            res.json({ 
                message: `Đồng bộ (Upsert) hoàn tất!`, 
                ...result
            });

        } catch (error) {
            console.error('Lỗi khi đồng bộ /api/admin/games/sync:', error);
            res.status(500).json({ message: 'Lỗi máy chủ khi đồng bộ game.', error: error.message });
        }
    });

  return router; // Trả về router
};