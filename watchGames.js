const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Game = require('./models/Game'); // Import model Game

// Kết nối MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/datn', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const gamesFilePath = path.join(__dirname, 'public', 'games.json');

// Hàm cập nhật dữ liệu vào database
async function updateGames() {
  try {
    const gamesData = JSON.parse(fs.readFileSync(gamesFilePath, 'utf-8'));
    for (const game of gamesData) {
      await Game.findOneAndUpdate(
        { id: game.id }, // Tìm theo ID
        game, // Cập nhật toàn bộ dữ liệu
        { upsert: true, new: true } // Nếu không tồn tại thì tạo mới
      );
    }
    console.log('Cập nhật dữ liệu thành công!');
  } catch (error) {
    console.error('Lỗi khi cập nhật dữ liệu:', error);
  }
}

// Hàm ghi dữ liệu vào file games.json
async function writeGamesToFile() {
  try {
    const games = await Game.find(); // Lấy toàn bộ dữ liệu từ database
    fs.writeFileSync(gamesFilePath, JSON.stringify(games, null, 2), 'utf-8');
    console.log('Cập nhật file games.json thành công!');
  } catch (error) {
    console.error('Lỗi khi ghi dữ liệu vào file:', error);
  }
}

// Theo dõi thay đổi trong file games.json
fs.watchFile(gamesFilePath, async (curr, prev) => {
  console.log('File games.json đã thay đổi, bắt đầu cập nhật...');
  await updateGames();
});

// Theo dõi thay đổi trong collection Game
async function watchDatabaseChanges() {
  const changeStream = Game.watch(); // Theo dõi thay đổi trong collection Game

  changeStream.on('change', async (change) => {
    console.log('Thay đổi trong database:', change);
    await writeGamesToFile(); // Cập nhật file games.json khi có thay đổi
  });

  console.log('Đang theo dõi thay đổi trong database...');
}

// Khởi động theo dõi
watchDatabaseChanges();

// Cập nhật lần đầu khi khởi động
updateGames();