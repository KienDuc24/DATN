const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Room = require('../models/Room');
const fs = require('fs').promises;
const path = require('path');
const GAMES_PATH = path.join(__dirname, '..', 'public', 'games.json');

// Basic admin endpoints (no auth). Add auth middleware if needed.

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const q = {};
    if (req.query.q) {
      const re = new RegExp(req.query.q, 'i');
      q.$or = [{ username: re }, { email: re }, { displayName: re }];
    }
    const users = await User.find(q).select('-password').limit(200).sort({ createdAt: -1 });
    return res.json({ ok: true, users });
  } catch (err) {
    console.error('[adminRoutes] get users error', err && err.message);
    return res.status(500).json({ ok: false, message: 'error' });
  }
});

// PUT /api/admin/user/:id  (update user fields: username, email, avatar, role)
router.put('/user/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const allowed = {};
    if (typeof req.body.username === 'string') allowed.username = req.body.username.trim();
    if (typeof req.body.email === 'string') allowed.email = req.body.email.trim();
    if (typeof req.body.avatar === 'string') allowed.avatar = req.body.avatar.trim();
    if (typeof req.body.role === 'string') allowed.role = req.body.role;

    if (Object.keys(allowed).length === 0) return res.status(400).json({ ok: false, message: 'no fields' });

    // ensure username unique if changing
    if (allowed.username) {
      const exist = await User.findOne({ username: allowed.username, _id: { $ne: id } });
      if (exist) return res.status(400).json({ ok: false, message: 'username exists' });
    }

    const updated = await User.findByIdAndUpdate(id, { $set: allowed }, { new: true }).select('-password');
    if (!updated) return res.status(404).json({ ok: false, message: 'Not found' });
    return res.json({ ok: true, user: updated });
  } catch (err) {
    console.error('[adminRoutes] update user error', err && err.message);
    return res.status(500).json({ ok: false, message: 'error' });
  }
});

// DELETE /api/admin/user/:id
router.delete('/user/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const removed = await User.findByIdAndDelete(id);
    if (!removed) return res.status(404).json({ ok: false, message: 'Not found' });
    return res.json({ ok: true, message: 'deleted' });
  } catch (err) {
    console.error('[adminRoutes] delete user error', err && err.message);
    return res.status(500).json({ ok: false, message: 'error' });
  }
});

// ROOMS

// GET /api/admin/rooms
router.get('/rooms', async (req, res) => {
  try {
    const q = {};
    if (req.query.q) q.name = new RegExp(req.query.q, 'i');
    const rooms = await Room.find(q).limit(500).sort({ createdAt: -1 });
    return res.json({ ok: true, rooms });
  } catch (err) {
    console.error('[adminRoutes] get rooms error', err && err.message);
    return res.status(500).json({ ok: false, message: 'error' });
  }
});

// PUT /api/admin/room/:id
router.put('/room/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const allowed = {};
    if (typeof req.body.name === 'string') allowed.name = req.body.name;
    if (typeof req.body.game === 'string') allowed.game = req.body.game;
    if (typeof req.body.owner === 'string') allowed.owner = req.body.owner;
    if (typeof req.body.status === 'string') allowed.status = req.body.status;
    if (Object.keys(allowed).length === 0) return res.status(400).json({ ok: false, message: 'no fields' });
    const updated = await Room.findByIdAndUpdate(id, { $set: allowed }, { new: true });
    if (!updated) return res.status(404).json({ ok: false, message: 'Not found' });
    return res.json({ ok: true, room: updated });
  } catch (err) {
    console.error('[adminRoutes] update room error', err && err.message);
    return res.status(500).json({ ok: false, message: 'error' });
  }
});

// DELETE /api/admin/room/:id
router.delete('/room/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const removed = await Room.findByIdAndDelete(id);
    if (!removed) return res.status(404).json({ ok: false, message: 'Not found' });
    return res.json({ ok: true, message: 'deleted' });
  } catch (err) {
    console.error('[adminRoutes] delete room error', err && err.message);
    return res.status(500).json({ ok: false, message: 'error' });
  }
});

// GAMES

// GET /api/admin/games
router.get('/games', async (req, res) => {
  try {
    const raw = await fs.readFile(GAMES_PATH, 'utf8');
    const list = JSON.parse(raw || '[]');
    return res.json({ ok: true, games: list });
  } catch (err) {
    console.error('[adminRoutes] read games error', err && err.message);
    return res.status(500).json({ ok: false, message: 'cannot read games' });
  }
});

// POST /api/admin/games  -> add new game
router.post('/games', async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.id) return res.status(400).json({ ok: false, message: 'id required' });

    const raw = await fs.readFile(GAMES_PATH, 'utf8');
    const list = JSON.parse(raw || '[]');

    if (list.find(g => (g.id || g._id) === payload.id)) return res.status(400).json({ ok: false, message: 'id exists' });

    // normalize fields
    const newGame = {
      id: payload.id,
      name: payload.name || { vi: payload.name_vi || '', en: payload.name_en || '' },
      desc: payload.desc || { vi: payload.desc_vi || '', en: payload.desc_en || '' },
      players: payload.players || '',
      category: payload.category || { vi: payload.category_vi || '', en: payload.category_en || '' }
    };
    list.push(newGame);
    await fs.writeFile(GAMES_PATH, JSON.stringify(list, null, 2), 'utf8');
    return res.json({ ok: true, game: newGame });
  } catch (err) {
    console.error('[adminRoutes] create game error', err && err.message);
    return res.status(500).json({ ok: false, message: 'cannot create game' });
  }
});

// PUT /api/admin/games/:id  -> update by id
router.put('/games/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body || {};
    const raw = await fs.readFile(GAMES_PATH, 'utf8');
    const list = JSON.parse(raw || '[]');
    const idx = list.findIndex(g => (g.id || g._id) === id);
    if (idx === -1) return res.status(404).json({ ok: false, message: 'not found' });

    const g = list[idx];
    // update fields if provided
    if (body.name) g.name = body.name;
    if (body.desc) g.desc = body.desc;
    if (typeof body.players === 'string') g.players = body.players;
    if (body.category) g.category = body.category;
    if (body.id && body.id !== id) {
      // ensure id unique
      if (list.find(x => (x.id || x._id) === body.id)) return res.status(400).json({ ok: false, message: 'id exists' });
      g.id = body.id;
    }

    list[idx] = g;
    await fs.writeFile(GAMES_PATH, JSON.stringify(list, null, 2), 'utf8');
    return res.json({ ok: true, game: g });
  } catch (err) {
    console.error('[adminRoutes] update game error', err && err.message);
    return res.status(500).json({ ok: false, message: 'cannot update game' });
  }
});

// DELETE /api/admin/games/:id
router.delete('/games/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const raw = await fs.readFile(GAMES_PATH, 'utf8');
    let list = JSON.parse(raw || '[]');
    const newList = list.filter(g => (g.id || g._id) !== id);
    if (newList.length === list.length) return res.status(404).json({ ok: false, message: 'not found' });
    await fs.writeFile(GAMES_PATH, JSON.stringify(newList, null, 2), 'utf8');
    return res.json({ ok: true });
  } catch (err) {
    console.error('[adminRoutes] delete game error', err && err.message);
    return res.status(500).json({ ok: false, message: 'cannot delete game' });
  }
});

module.exports = router;