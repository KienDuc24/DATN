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