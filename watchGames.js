const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Game = require('./models/Game'); 

const gamesDir = path.join(__dirname, 'public', 'game');
const gamesJson = path.join(__dirname, 'public', 'games.json');

async function updateGamesJson() {
  const games = [];
  const dbOperations = []; 

  if (fs.existsSync(gamesDir)) {
    fs.readdirSync(gamesDir).forEach(folder => {
        const infoPath = path.join(gamesDir, folder, 'infor.json');
        if (fs.existsSync(infoPath)) {
        try {
            let info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
            if (Array.isArray(info)) info = info[0];
            if (!info.id) info.id = folder;

            if (!info.id || typeof info.id !== 'string') return;

            games.push({ ...info, isComingSoon: false }); 
            
            dbOperations.push(
            Game.updateOne(
                { id: info.id }, 
                { 

                $set: {
                    name: info.name,
                    desc: info.desc,
                    players: info.players,
                    category: info.category,
                    isComingSoon: false 
                },

                $setOnInsert: {
                    featured: false 
                }
                },
                { upsert: true } 
            )
            );

        } catch (e) {
            console.error('Lỗi đọc JSON trong', infoPath, e);
        }
        }
    });
  }
  
  fs.writeFileSync(gamesJson, JSON.stringify(games, null, 2), 'utf8');
  console.log('games.json đã được cập nhật!');

  if (mongoose.connection.readyState === 1) {
    try {
        await Promise.all(dbOperations);
        console.log(`[DB] Đã đồng bộ ${dbOperations.length} game vào cơ sở dữ liệu.`);
    } catch (dbErr) {
        console.error('[DB] Lỗi cập nhật game:', dbErr.message);
    }
  }
}

function setupGameWatcher() {
    console.log('Đang theo dõi thư mục game...');
    chokidar.watch(gamesDir, {ignoreInitial: true, depth: 2})
      .on('add', updateGamesJson)
      .on('change', updateGamesJson)
      .on('unlink', updateGamesJson)
      .on('addDir', updateGamesJson)
      .on('unlinkDir', updateGamesJson);

    return updateGamesJson;
}

module.exports = setupGameWatcher;