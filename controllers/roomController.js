const mongoose = require('mongoose');
const Room = require('../models/Room');
const User = require('../models/User');

function generateRoomCode() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const letter = letters.charAt(Math.floor(Math.random() * letters.length));
  const number = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${letter}${number}`;
}

exports.createRoom = async (req, res) => {
  const { player, game, gameType, role } = req.body;

  if (!player || !game || !gameType || !role) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let displayName = player;
  if (!player.startsWith('guest_')) {
      try {
          const userObj = await User.findOne({ username: player });
          if (userObj && userObj.displayName) {
              displayName = userObj.displayName;
          }
      } catch (e) {
          console.error('Error fetching host display name:', e);
      }
  }
  
  const roomCode = generateRoomCode();

  const newRoom = new Room({
    code: roomCode,
    host: player,
    players: [{ name: player }],
    game: { gameId: game, type: gameType },
    status: 'open' 
  });

  try {
    await newRoom.save();
    return res.status(201).json({
      roomCode: newRoom.code,
      room: {
        id: newRoom._id,
        code: newRoom.code,
        game: newRoom.game,
        players: newRoom.players.map(p => p.name),
        status: newRoom.status
      }
    });
  } catch (err) {
    console.error('[roomController] Error creating room:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.checkRoom = async (req, res) => {
  const { code, gameId } = req.query;

  if (!code || !gameId) {
    return res.status(400).json({ error: 'code and gameId are required' });
  }

  try {
    const room = await Room.findOne({ code, 'game.gameId': gameId });
    if (!room) {
      return res.status(404).json({ found: false, message: 'Room not found' });
    }

    if (room.status === 'playing') {
      return res.status(403).json({ 
        found: false, 
        message: 'Phòng này đã bắt đầu. Không thể tham gia!' 
      });
    }

    return res.status(200).json({ found: true, room });
  } catch (err) {
    console.error('[roomController] Error fetching room:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.joinRoom = async (req, res, next) => {
  try {
    const { player, code, gameId } = req.body || {};
    if (!player || !code || !gameId) {
      return res.status(400).json({ error: 'player, code, and gameId are required' });
    }

    const room = await Room.findOneAndUpdate(
      { code, 'game.gameId': gameId, status: 'open' }, 
      { $addToSet: { players: { name: player } } },
      { new: true }
    ).select('code game players');

    if (!room) {
      return res.status(404).json({ error: 'Room not found or is already playing' });
    }

    return res.json({
      success: true,
      room: {
        id: room._id,
        code: room.code,
        players: room.players.map(p => p.name),
        game: room.game
      }
    });
  } catch (err) {
    next(err);
  }
};