// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const Report = require('../models/Report');

module.exports = function(io) {
  
  router.get('/stats', async (req, res) => {
      try {
          const stats = await adminController.getStats();
          res.json(stats);
      } catch (e) {
          res.status(500).json({ message: e.message });
      }
  });

  router.get('/users', async (req, res) => {
    try {
      const q = req.query.q;
      const page = parseInt(req.query.page) || 1;
      const limit = 10; 
      
      let query = {};
      if (q) {
        const regex = { $regex: q, $options: 'i' };
        query = { $or: [{ username: regex }, { email: regex }, { displayName: regex }] };
      }
      
      const result = await adminController.getAllUsers(query, page, limit); 
      res.json(result);
    } catch (e) { res.status(500).json({ message: e.message }); }
  });
  
  router.post('/users', async (req, res) => {
      try {
          const newUser = await adminController.createUser(req.body);
          io.emit('admin-users-changed'); 
          res.status(201).json({ ok: true, user: newUser, message: 'User created successfully' });
      } catch(e) { 
          res.status(400).json({ message: e.message }); 
      }
  });

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

  router.delete('/rooms/:id', async (req, res) => {
      try {
        await adminController.deleteRoom(req.params.id);
        io.to(req.params.id).emit('kicked', { message: 'Phòng đã bị đóng.' });
        io.emit('admin-rooms-changed'); res.json({ok:true});
      } catch(e) { res.status(500).json({message:e.message}); }
  });


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

  router.get('/reports', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        
        const q = req.query.q;
        let query = {};
        if (q) {
             query = { $or: [{ reporterName: { $regex: q, $options: 'i' } }, { content: { $regex: q, $options: 'i' } }] };
        }

        const total = await Report.countDocuments(query);
        const data = await Report.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({ 
            data, 
            total, 
            page, 
            pages: Math.ceil(total / limit) 
        });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ message: e.message }); 
    }
  });

  router.get('/reports/:id', async (req, res) => {
      try {
          const report = await Report.findById(req.params.id);
          if (!report) return res.status(404).json({ message: 'Report not found' });
          res.json(report);
      } catch (e) { res.status(500).json({ message: e.message }); }
  });

  router.put('/reports/:id', async (req, res) => {
      try {
          const { status, adminNote } = req.body;
          const updated = await Report.findByIdAndUpdate(
              req.params.id, 
              { status, note: adminNote }, 
              { new: true }
          );
          io.emit('admin-reports-changed'); 
          res.json({ ok: true, report: updated });
      } catch (e) { res.status(500).json({ message: e.message }); }
  });

  router.delete('/reports/:id', async (req, res) => {
      try {
          await Report.findByIdAndDelete(req.params.id);
          io.emit('admin-reports-changed');
          res.json({ ok: true });
      } catch (e) { res.status(500).json({ message: e.message }); }
  });

  return router;
};