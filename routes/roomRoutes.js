const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const roomController = require('../controllers/roomController'); 

router.use((req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    console.error('[roomRoutes] Database not ready');
    return res.status(503).json({ error: 'Database not ready' });
  }
  next();
});

router.post('/', roomController.createRoom); 

router.get('/', roomController.checkRoom); 

router.post('/join', roomController.joinRoom); 

router.use((err, req, res, next) => {
  console.error('[roomRoutes] Unexpected error:', err.message);
  res.status(500).json({ error: 'Internal Server Error' });
});

module.exports = router;