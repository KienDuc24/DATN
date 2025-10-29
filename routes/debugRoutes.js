const express = require('express');
const router = express.Router();
const Room = require('../models/Room');

// optional simple protection: require ?secret=DEBUG_SECRET
router.get('/rooms', async (req, res) => {
  const secret = process.env.DEBUG_SECRET || 'debug';
  if (req.query.secret !== secret) return res.status(403).json({ ok:false, message:'forbidden' });
  try {
    const rooms = await Room.find({}).lean().limit(200);
    return res.json({ ok:true, count: rooms.length, rooms });
  } catch (e) {
    console.error('[debugRoutes] /rooms error', e);
    return res.status(500).json({ ok:false, message:'server error' });
  }
});

module.exports = router;