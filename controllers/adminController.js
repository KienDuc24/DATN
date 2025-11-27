const User = require('../models/User');
const Room = require('../models/Room');
const Game = require('../models/Game');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

async function paginate(model, query, page, limit) {
    const skip = (page - 1) * limit;
    
    const total = await model.countDocuments(query);
    
    let queryBuilder = model.find(query)
             .sort({ createdAt: -1 }) 
             .skip(skip)
             .limit(limit)
             .lean(); 

    const data = await queryBuilder;

    return { 
        data, 
        total, 
        page, 
        pages: Math.ceil(total / limit) 
    };
}

exports.getAllUsers = (query = {}, page = 1, limit = 10) => {
    return paginate(User, query, page, limit);
};

exports.createUser = async ({ username, password, displayName, email }) => {
    if (!username || !password) throw new Error('Username and password are required');
    
    const existingUser = await User.findOne({ username });
    if (existingUser) throw new Error('Username already exists');

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = new User({ 
        username, 
        displayName: displayName || username,
        email: email || undefined, 
        password: hashedPassword,
        role: 'user' 
    });
    
    return newUser.save();
};

exports.updateUser = (id, updates) => {

    const allowedUpdates = {};
    if (updates.displayName) allowedUpdates.displayName = updates.displayName;
    if (updates.email !== undefined) allowedUpdates.email = updates.email;

    return User.findByIdAndUpdate(id, allowedUpdates, { new: true });
};

exports.deleteUser = (id) => {
    return User.findByIdAndDelete(id);
};

exports.getAllRooms = (query = {}, page = 1, limit = 10) => {
    return paginate(Room, query, page, limit);
};

exports.deleteRoom = (roomCode) => {
    return Room.findOneAndDelete({ code: roomCode });
};

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
        };

        const result = await Game.updateOne({ id: game.id }, { $set: updatePayload }, { upsert: true });

        if (result.upsertedCount) { created++; }
        else if (result.modifiedCount) { updated++; }
    }

    return { updated, created };
};