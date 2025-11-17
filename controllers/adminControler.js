// controllers/adminController.js (File mới)

const User = require('../models/User');
const Room = require('../models/Room');
const Game = require('../models/Game');

// --- USER ---
exports.getAllUsers = () => {
    return User.find().select('-password');
};

exports.updateUser = (id, updates) => {
    return User.findByIdAndUpdate(id, updates, { new: true }).select('-password');
};

exports.deleteUser = (id) => {
    return User.findByIdAndDelete(id);
};

// --- ROOM ---
exports.getAllRooms = () => {
    return Room.find();
};

exports.deleteRoom = (roomCode) => {
    // (Lưu ý: logic emit 'kicked' sẽ nằm ở route)
    return Room.findOneAndDelete({ code: roomCode });
};

// --- GAME ---
exports.getAllGames = () => {
    return Game.find({});
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

exports.syncGames = async (gamesData) => {
    if (!Array.isArray(gamesData)) {
        throw new Error('Dữ liệu gửi lên không phải là một mảng (array).');
    }

    let updatedCount = 0;
    let createdCount = 0;

    for (const game of gamesData) {
        if (!game.id) {
            console.warn('[AdminSync] Bỏ qua game không có ID:', game.name);
            continue; 
        }

        const existingGame = await Game.findOne({ id: game.id });

        if (existingGame) {
            await Game.updateOne({ id: game.id }, game, { runValidators: true });
            updatedCount++;
        } else {
            await Game.create(game);
            createdCount++;
        }
    }

    return { updated: updatedCount, created: createdCount };
};