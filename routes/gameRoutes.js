const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

router.get('/', (req, res) => {
  const gamesPath = path.join(__dirname, '../public/games.json');
  fs.readFile(gamesPath, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Không đọc được dữ liệu game' });
    res.json(JSON.parse(data));
  });
});

module.exports = router;

