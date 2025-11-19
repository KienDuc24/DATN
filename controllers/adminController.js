// controllers/adminController.js (CHỈ COPY TOÀN BỘ FILE NÀY)

const User = require('../models/User');
const Room = require('../models/Room');
const Game = require('../models/Game');
const fs = require('fs');
const path = require('path');

// Hàm hỗ trợ phân trang chung
async function paginate(model, query, page, limit) {
    const skip = (page - 1) * limit;
    
    // Đếm tổng số lượng (Phải đếm trước khi skip/limit)
    const total = await model.countDocuments(query);
    
    // Thêm .lean() cho hiệu năng tốt hơn
    let queryBuilder = model.find(query)
             .sort({ createdAt: -1 }) // Sắp xếp mới nhất trước
             .skip(skip)
             .limit(limit)
             .lean(); 

    // Nếu là User, ta muốn lấy cả lịch sử chơi
    if (model === User) {
        // Mongoose 8+ tự động xử lý sub-schema, chỉ cần .lean() để tăng tốc
    }

    const data = await queryBuilder;

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
    // Chỉ cho phép cập nhật displayName và email từ Admin
    const allowedUpdates = {};
    if (updates.displayName) allowedUpdates.displayName = updates.displayName;
    if (updates.email !== undefined) allowedUpdates.email = updates.email; // Cho phép gán null/empty

    // Lấy user sau khi sửa, bao gồm cả lịch sử chơi
    return User.findByIdAndUpdate(id, allowedUpdates, { new: true });
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

// FIX LOGIC: Sync Games chỉ cập nhật từ files.json (isComingSoon được xử lý bởi watchGames.js)
exports.syncGames = async () => {
    const gamesJsonPath = path.join(__dirname, '..', 'public', 'games.json');
    if (!fs.existsSync(gamesJsonPath)) return { updated: 0, created: 0 };
    
    const gamesData = JSON.parse(fs.readFileSync(gamesJsonPath, 'utf8'));
    
    if (!Array.isArray(gamesData)) throw new Error('Dữ liệu games.json không hợp lệ');
    let updated = 0, created = 0;
    
    for (const game of gamesData) {
        if (!game.id) continue;
        
        const updatePayload = {
            name: game.name,
            desc: game.desc,
            players: game.players,
            category: game.category,
            featured: game.featured || false,
            // isComingSoon được cập nhật bởi watchGames.js khi file game tồn tại
        };

        const result = await Game.updateOne({ id: game.id }, { $set: updatePayload }, { upsert: true });

        if (result.upsertedCount) { created++; }
        else if (result.modifiedCount) { updated++; }
    }

    return { updated, created };
};