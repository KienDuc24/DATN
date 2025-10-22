const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Room = require('../models/Room');

exports.updateProfile = async (req, res) => {
  try {
    const { username, displayName, avatarUrl } = req.body;
    if (!username) return res.status(400).json({ error: 'username required' });

    const upd = {};
    if (displayName !== undefined) upd.displayName = displayName;
    if (avatarUrl !== undefined) upd.avatarUrl = avatarUrl;

    const user = await User.findOneAndUpdate(
      { username },
      { $set: upd },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    if (avatarUrl !== undefined) {
      // update avatar in any room players that match this username
      await Room.updateMany(
        { 'players.name': username },
        { $set: { 'players.$.avatar': avatarUrl } }
      );
    }

    return res.json({ ok: true, user });
  } catch (err) {
    console.error('updateProfile error', err);
    return res.status(500).json({ error: 'server_error' });
  }
};

// new: handle avatar upload (multer middleware will store file)
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No file uploaded' });

    // public/uploads relative path (ensure folder exists)
    const filename = req.file.filename;
    const publicUrl = `/uploads/${filename}`; // accessible if /public served at '/'

    const { username } = req.body;
    if (username) {
      // update user doc and any room players with this username
      const user = await User.findOneAndUpdate(
        { username },
        { $set: { avatarUrl: publicUrl } },
        { new: true }
      ).lean();

      await Room.updateMany(
        { 'players.name': username },
        { $set: { 'players.$.avatar': publicUrl } }
      );

      return res.json({ ok: true, url: publicUrl, user });
    }

    return res.json({ ok: true, url: publicUrl });
  } catch (err) {
    console.error('uploadAvatar error', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
};