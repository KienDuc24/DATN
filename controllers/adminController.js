// controllers/adminController.js

const User = require('../models/User');
const Room = require('../models/Room');
const Game = require('../models/Game');

// Hàm hỗ trợ phân trang chung
async function paginate(model, query, page, limit) {
    const skip = (page - 1) * limit;
    
    // Đếm tổng số lượng (Phải đếm trước khi skip/limit)
    const total = await model.countDocuments(query);
    
    const data = await model.find(query)
             .sort({ createdAt: -1 }) // Sắp xếp mới nhất trước
             .skip(skip)
             .limit(limit)
             .lean(); // Tăng tốc độ query

    return { 
        data, 
        total, 
        page, 
        pages: Math.ceil(total / limit) // Trả về tổng số trang
    };
}

// --- USER ---
exports.getAllUsers = (query = {}, page = 1, limit = 10) => {
    // Thêm .populate('playHistory') nếu cần, nhưng hiện tại playHistory đã là sub-schema
    return paginate(User, query, page, limit);
};

exports.updateUser = (id, updates) => {
    // Chỉ cho phép cập nhật displayName và email từ Admin
    const allowedUpdates = {};
    if (updates.displayName) allowedUpdates.displayName = updates.displayName;
    if (updates.email) allowedUpdates.email = updates.email;
    
    // Thêm lịch sử game vào kết quả trả về
    return User.findByIdAndUpdate(id, allowedUpdates, { new: true }).select('-password');
};

exports.deleteUser = (id) => {
    return User.findByIdAndDelete(id);
};

// --- ROOM ---
exports.getAllRooms = (query = {}, page = 1, limit = 10) => {
    return paginate(Room, query, page, limit);
};

exports.deleteRoom = (roomCode) => {
    return Room.findOneAndDelete({ code: roomCode });
};

// --- GAME ---
exports.getAllGames = (query = {}, page = 1, limit = 10) => {
    return paginate(Game, query, page, limit);
};

exports.createGame = (gameData) => {
    const newGame = new Game(gameData);
    return newGame.save();
};

exports.updateGame = (gameId, updates) => {
    return Game.findOneAndUpdate({ id: gameId }, updates, { new: true });
};

exports.deleteGame = (gameId) => {
    return Game.findOneAndDelete({ id: gameId });
};

// Hàm mới: Tính toán và trả về Stats (Fix lỗi không hiển thị tổng)
exports.getStats = async () => {
    const totalGames = await Game.countDocuments({});
    const totalRooms = await Room.countDocuments({ status: { $in: ['open', 'playing'] } });
    const onlineUsers = await User.countDocuments({ status: { $in: ['online', 'playing'] } });
    const totalUsers = await User.countDocuments({ username: { $not: /^guest_/ } });

    return {
        totalGames,
        totalRooms,
        onlineUsers,
        totalUsers
    };
};

// (Giữ nguyên hàm syncGames)
exports.syncGames = async () => {
    const fs = require('fs');
    const path = require('path');
    const gamesJsonPath = path.join(__dirname, '..', 'public', 'games.json');
    if (!fs.existsSync(gamesJsonPath)) return { updated: 0, created: 0 };
    
    const gamesData = JSON.parse(fs.readFileSync(gamesJsonPath, 'utf8'));
    
    if (!Array.isArray(gamesData)) throw new Error('Dữ liệu games.json không hợp lệ');
    let updated = 0, created = 0;
    
    for (const game of gamesData) {
        if (!game.id) continue;
        
        // Logic đồng bộ: Nếu file game tồn tại, isComingSoon = false.
        // Ngược lại, nếu game không có trong folder, ta không xử lý cờ isComingSoon ở đây.
        // Giả định rằng `watchGames.js` xử lý cờ `isComingSoon` cho các game đã tồn tại trên file system.
        
        const updatePayload = {
            name: game.name,
            desc: game.desc,
            players: game.players,
            category: game.category,
            featured: game.featured || false,
            // isComingSoon không được set ở đây.
        };

        const result = await Game.updateOne({ id: game.id }, { $set: updatePayload }, { upsert: true });

        if (result.upsertedCount) { created++; }
        else if (result.modifiedCount) { updated++; }
    }
    
    // Xử lý các game không còn trong files.json (nếu cần xóa)
    // Hiện tại ta giữ lại, chỉ cập nhật status khi file game bị xóa.

    return { updated, created };
};