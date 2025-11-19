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
    return paginate(User, query, page, limit);
};

exports.updateUser = (id, updates) => {
    return User.findByIdAndUpdate(id, updates, { new: true }).select('-password');
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

// (Giữ nguyên hàm syncGames)
exports.syncGames = async (gamesData) => {
    // ... (Giữ nguyên nội dung cũ)
    if (!Array.isArray(gamesData)) throw new Error('Dữ liệu không hợp lệ');
    let updated = 0, created = 0;
    for (const game of gamesData) {
        if (!game.id) continue;
        const exists = await Game.findOne({ id: game.id });
        if (exists) { await Game.updateOne({ id: game.id }, game); updated++; }
        else { await Game.create(game); created++; }
    }
    return { updated, created };
};