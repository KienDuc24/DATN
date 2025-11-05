const path = require('path');
const fs = require('fs');
const Room = require('../models/Room');
const User = require('../models/User');

// Trả về user nhưng không kèm password/hash
function sanitizeUser(user) {
  if (!user) return null;
  const u = user.toObject ? user.toObject() : Object.assign({}, user);
  delete u.password;
  delete u.passwordHash;
  return u;
}

exports.getUserByUsername = async (req, res) => {
  const username = req.params.username || req.query.username;
  if (!username) return res.status(400).json({ ok: false, message: 'username required' });
  const user = await User.findOne({ username }).select('-password -passwordHash');
  if (!user) return res.status(404).json({ ok: false, message: 'Not found' });
  return res.json({ ok: true, user });
};

exports.updateUser = async (req, res) => {
  try {
    const body = req.body || {};
    // require identifier: prefer username or _id
    const identifier = body.username || body._id || (req.user && req.user.username);
    if (!identifier) return res.status(400).json({ ok: false, message: 'username or _id required' });

    const query = body._id ? { _id: body._id } : { username: identifier };
    // Fields allowed to update
    const allowed = {};
    if (typeof body.displayName === 'string') allowed.displayName = body.displayName;
    if (typeof body.email === 'string') allowed.email = body.email;
    if (typeof body.avatar === 'string') allowed.avatar = body.avatar;
    if (Object.keys(allowed).length === 0) {
      return res.status(400).json({ ok: false, message: 'no updatable fields' });
    }

    const updated = await User.findOneAndUpdate(query, { $set: allowed }, { new: true }).select('-password -passwordHash');
    if (!updated) return res.status(404).json({ ok: false, message: 'User not found' });

    return res.json({ ok: true, user: sanitizeUser(updated) });
  } catch (err) {
    console.error('updateUser error', err);
    return res.status(500).json({ ok: false, message: 'Internal error' });
  }
};

// new: handle avatar upload (multer middleware will store file)
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, message: 'No file uploaded' });

    // file stored by multer in uploads folder
    const file = req.file;
    // build accessible url
    const host = req.get('host');
    const proto = req.protocol;
    const url = `${proto}://${host}/uploads/${path.basename(file.path)}`;

    // if client provided username or _id, update user record
    const username = req.body.username || (req.user && req.user.username);
    if (username) {
      const updated = await User.findOneAndUpdate(
        { $or: [{ username }, { _id: username }] },
        { $set: { avatar: url } },
        { new: true }
      ).select('-password -passwordHash');
      if (updated) {
        return res.json({ ok: true, url, user: sanitizeUser(updated) });
      }
    }

    return res.json({ ok: true, url });
  } catch (err) {
    console.error('uploadAvatar error', err);
    return res.status(500).json({ ok: false, message: 'Upload failed' });
  }
};

// Tạo phòng (thay đổi: thêm validation)
exports.createRoom = async (req, res) => {
  try {
    const { name, gameType, maxPlayers } = req.body;
    if (!name || !gameType) return res.status(400).json({ error: 'Name and gameType required' });
    
    const room = new Room({ name, gameType, maxPlayers, players: [req.user.id] });
    await room.save();
    res.status(201).json(room);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create room' });
  }
};

// Tham gia phòng (thay đổi: kiểm tra số lượng người chơi)
exports.joinRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room || room.players.length >= room.maxPlayers) return res.status(400).json({ error: 'Room full or not found' });
    
    if (!room.players.includes(req.user.id)) {
      room.players.push(req.user.id);
      await room.save();
    }
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: 'Failed to join room' });
  }
};