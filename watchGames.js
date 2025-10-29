const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');

const gamesDir = path.join(__dirname, 'public', 'game');
const gamesJson = path.join(__dirname, 'public', 'games.json');

// Hàm quét thư mục game và cập nhật games.json
function updateGamesJson() {
  const games = [];
  fs.readdirSync(gamesDir).forEach(folder => {
    const infoPath = path.join(gamesDir, folder, 'infor.json');
    if (fs.existsSync(infoPath)) {
      try {
        // Đọc file infor.json
        let info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
        // Nếu là mảng, lấy phần tử đầu tiên
        if (Array.isArray(info)) info = info[0];
        // Thêm id nếu thiếu
        if (!info.id) info.id = folder;
        // Giữ nguyên object cho name, desc, category
        games.push(info);
      } catch (e) {
        console.error('Lỗi đọc', infoPath, e);
      }
    }
  });
  fs.writeFileSync(gamesJson, JSON.stringify(games, null, 2), 'utf8');
  console.log('games.json đã được cập nhật!');
}

// Theo dõi thay đổi trong thư mục game
chokidar.watch(gamesDir, {ignoreInitial: true, depth: 2})
  .on('add', updateGamesJson)
  .on('change', updateGamesJson)
  .on('unlink', updateGamesJson)
  .on('addDir', updateGamesJson)
  .on('unlinkDir', updateGamesJson);

console.log('Đang theo dõi thay đổi trong thư mục game...');

// Khởi tạo lần đầu
updateGamesJson();