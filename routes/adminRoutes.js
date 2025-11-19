// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

module.exports = function(io) {
  
  // --- STATS (Fix lỗi không hiển thị tổng) ---
  router.get('/stats', async (req, res) => {
      try {
          const stats = await adminController.getStats();
          res.json(stats);
      } catch (e) {
          res.status(500).json({ message: e.message });
      }
  });


  // --- USER ---
  router.get('/users', async (req, res) => {
    try {
      const q = req.query.q;
      const page = parseInt(req.query.page) || 1;
      const limit = 10; // Cố định 10 item/trang
      
      let query = {};
      if (q) {
        const regex = { $regex: q, $options: 'i' };
        query = { $or: [{ username: regex }, { email: regex }, { displayName: regex }] };
      }
      
      // Kết quả trả về sẽ có dạng { data: [], total: 100, page: 1, pages: 10 }
      const result = await adminController.getAllUsers(query, page, limit); 
      res.json(result);
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // Route SỬA USER (PUT)
  router.put('/users/:id', async (req, res) => {
     try {
        const u = await adminController.updateUser(req.params.id, req.body);
        io.emit('admin-users-changed'); 
        res.json(u);
     } catch(e) { res.status(500).json({message: e.message}); }
  });
  
  router.delete('/users/:id', async (req, res) => {
     try {
        await adminController.deleteUser(req.params.id);
        io.emit('admin-users-changed'); res.json({ok:true});
     } catch(e) { res.status(500).json({message: e.message}); }
  });


  // --- ROOMS ---
  router.get('/rooms', async (req, res) => {
    try {
      const q = req.query.q;
      const page = parseInt(req.query.page) || 1;
      const limit = 10;

      let query = {};
      if (q) {
        const regex = { $regex: q, $options: 'i' };
        query = { $or: [{ code: regex }, { host: regex }] };
      }
      const result = await adminController.getAllRooms(query, page, limit);
      res.json(result);
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // (Route DELETE Room giữ nguyên)
  router.delete('/rooms/:id', async (req, res) => {
      try {
        await adminController.deleteRoom(req.params.id);
        io.to(req.params.id).emit('kicked', { message: 'Phòng đã bị đóng.' });
        io.emit('admin-rooms-changed'); res.json({ok:true});
      } catch(e) { res.status(500).json({message:e.message}); }
  });


  // --- GAMES ---
  router.get('/games', async (req, res) => {
    try {
        const q = req.query.q;
        const page = parseInt(req.query.page) || 1;
        const limit = 10;

        let query = {};
        if (q) {
          const regex = { $regex: q, $options: 'i' };
          query = { $or: [{ id: regex }, { 'name.vi': regex }, { 'name.en': regex }] };
        }
        const result = await adminController.getAllGames(query, page, limit);
        res.json(result);
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // (Các route POST, PUT, DELETE, SYNC Game giữ nguyên)
  router.post('/games', async (req, res) => {
      try { await adminController.createGame(req.body); io.emit('admin-games-changed'); res.status(201).json({ok:true}); } catch(e){ res.status(500).json({message:e.message}); }
  });
  router.put('/games/:id', async (req, res) => {
      try { await adminController.updateGame(req.params.id, req.body); io.emit('admin-games-changed'); res.json({ok:true}); } catch(e){ res.status(500).json({message:e.message}); }
  });
  router.delete('/games/:id', async (req, res) => {
      try { await adminController.deleteGame(req.params.id); io.emit('admin-games-changed'); res.json({ok:true}); } catch(e){ res.status(500).json({message:e.message}); }
  });
  router.post('/games/sync', async (req, res) => {
      try { const r = await adminController.syncGames(req.body); io.emit('admin-games-changed'); res.json(r); } catch(e){ res.status(500).json({message:e.message}); }
  });

  return router;
};