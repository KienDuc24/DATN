// watchGames.js (TỐI ƯU HÓA: Chỉ thực hiện Upsert, không bao gồm logic xóa)

const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Game = require('./models/Game'); // Import Game model

const gamesDir = path.join(__dirname, 'public', 'game');
const gamesJson = path.join(__dirname, 'public', 'games.json');

/**
 * Quét thư mục game, tạo games.json, và thực hiện Upsert (Insert/Update)
 * các game lên MongoDB. KHÔNG bao gồm logic xóa game khỏi database.
 */
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

        // Bỏ qua các game không có ID nghiệp vụ hợp lệ
        if (!info.id || typeof info.id !== 'string') return;

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
                featured: info.featured || false,
              }
            },
            { upsert: true } // Nếu không tìm thấy, tạo mới (Upsert)
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
  if (mongoose.connection.readyState === 1) {
    try {
        await Promise.all(dbOperations);
        console.log(`[DB] Đã cập nhật/thêm ${dbOperations.length} game vào MongoDB (Upsert).`);
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
      .on('unlinkDir', updateGamesJson); // Mặc dù có unlink, logic bên trong vẫn là Upsert
                                       // Chỉ cập nhật games.json và không chạy lệnh xóa database.

    // Chạy lần đầu sau khi CSDL kết nối
    return updateGamesJson;
}

module.exports = setupGameWatcher;