// watchGames.js

const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Game = require('./models/Game'); // Import Game model

const gamesDir = path.join(__dirname, 'public', 'game');
const gamesJson = path.join(__dirname, 'public', 'games.json');

// Hàm quét thư mục game và cập nhật games.json
async function updateGamesJson() {
  const games = [];
  const dbOperations = []; // Lưu trữ các thao tác CSDL

  fs.readdirSync(gamesDir).forEach(folder => {
    const infoPath = path.join(gamesDir, folder, 'infor.json');
    if (fs.existsSync(infoPath)) {
      try {
        let info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
        if (Array.isArray(info)) info = info[0];
        if (!info.id) info.id = folder;

        games.push(info);
        
        // Thao tác CSDL: upsert (Update hoặc Insert)
        dbOperations.push(
          Game.updateOne(
            { id: info.id }, // Tìm kiếm bằng ID nghiệp vụ
            { 
              $set: {
                name: info.name,
                desc: info.desc,
                players: info.players,
                category: info.category,
                featured: info.featured || false, // Đảm bảo có giá trị mặc định
              }
            },
            { upsert: true } // Nếu không tìm thấy, tạo mới
          )
        );

      } catch (e) {
        console.error('Lỗi đọc hoặc phân tích cú pháp JSON trong', infoPath, e);
      }
    }
  });
  
  // Ghi games.json (cho mục đích public)
  fs.writeFileSync(gamesJson, JSON.stringify(games, null, 2), 'utf8');
  console.log('games.json đã được cập nhật!');

  // Thực hiện các thao tác CSDL
  if (mongoose.connection.readyState === 1) { // Chỉ chạy khi đã kết nối
    try {
        await Promise.all(dbOperations);
        console.log(`[DB] Đã cập nhật/thêm ${dbOperations.length} game vào MongoDB.`);
    } catch (dbErr) {
        console.error('[DB] Lỗi khi cập nhật game lên MongoDB:', dbErr.message);
    }
  } else {
    console.log('[DB] Bỏ qua cập nhật MongoDB, CSDL chưa kết nối.');
  }
}

// Hàm khởi tạo và theo dõi
function setupGameWatcher() {
    console.log('Đang theo dõi thay đổi trong thư mục game...');
    
    // Theo dõi thay đổi trong thư mục game
    chokidar.watch(gamesDir, {ignoreInitial: true, depth: 2})
      .on('add', updateGamesJson)
      .on('change', updateGamesJson)
      .on('unlink', updateGamesJson)
      .on('addDir', updateGamesJson)
      .on('unlinkDir', updateGamesJson);

    // Chạy lần đầu sau khi CSDL kết nối (được gọi từ index.js)
    return updateGamesJson;
}

module.exports = setupGameWatcher;