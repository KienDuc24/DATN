const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Room = require('../models/Room');
const fs = require('fs').promises;
const path = require('path');
const GAMES_PATH = path.join(__dirname, '..', 'public', 'games.json');

// requireAdmin bây giờ kiểm tra cookie adminUser và xác thực role trong DB
async function requireAdmin(req, res, next) {
  try {
    const adminUserId = req.cookies && req.cookies.adminUser;
    if (!adminUserId) return res.status(403).json({ error: 'Forbidden: admin only' });

    const user = await User.findById(adminUserId).select('role username');
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: admin only' });
    }
    // attach user cho handler nếu cần
    req.user = user;
    next();
  } catch (err) {
    console.error('[adminRoutes] requireAdmin error', err && err.message);
    return res.status(500).json({ ok: false, message: 'error' });
  }
}

// helper: kiểm tra cookie + DB, trả user nếu là admin
async function getAdminUser(req) {
  const adminUserId = req.cookies && req.cookies.adminUser;
  if (!adminUserId) return null;
  const user = await User.findById(adminUserId).select('role username');
  if (!user || user.role !== 'admin') return null;
  return user;
}

// Ví dụ route GET /api/admin/users (không dùng middleware)
router.get('/users', async (req, res) => {
  try {
    const admin = await getAdminUser(req);
    if (!admin) return res.status(403).json({ ok:false, message: 'Forbidden: admin only' });

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
router.put('/user/:id', requireAdmin, async (req, res) => {
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
router.delete('/user/:id', requireAdmin, async (req, res) => {
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
router.get('/rooms', requireAdmin, async (req, res) => {
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
router.put('/room/:id', requireAdmin, async (req, res) => {
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
router.delete('/room/:id', requireAdmin, async (req, res) => {
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
router.get('/games', requireAdmin, async (req, res) => {
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
router.post('/games', requireAdmin, async (req, res) => {
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
      category: payload.category || { vi: payload.category_vi || '', en: payload.category_en || '' },
      featured: !!payload.featured
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
router.put('/games/:id', requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body || {};
    const raw = await fs.readFile(GAMES_PATH, 'utf8');
    const list = JSON.parse(raw || '[]');

    const idx = list.findIndex(g => String((g.id || g._id || '')).toLowerCase() === String(id).toLowerCase());
    if (idx === -1) {
      return res.status(404).json({ ok:false, message: 'game not found' });
    }

    const game = list[idx];

    // Update allowed fields
    if (body.name) game.name = body.name;
    if (body.desc) game.desc = body.desc;
    if (typeof body.players === 'string') game.players = body.players;
    if (body.category) game.category = body.category;
    if (typeof body.featured !== 'undefined') game.featured = !!body.featured;
    if (body.id && body.id !== id) {
      // ensure new id unique
      if (list.some((x, i) => i !== idx && ((x.id || x._id) === body.id))) {
        return res.status(400).json({ ok:false, message: 'id exists' });
      }
      game.id = body.id;
    }

    list[idx] = game;
    await fs.writeFile(GAMES_PATH, JSON.stringify(list, null, 2), 'utf8');

    return res.json({ ok:true, game });
  } catch (err) {
    console.error('[adminRoutes] PUT /games/:id error', err && err.stack ? err.stack : err);
    // trả thông tin ngắn gọn cho client, log chi tiết ở server
    return res.status(500).json({ ok:false, message: 'cannot update game', error: err.message });
  }
});

// DELETE /api/admin/games/:id
router.delete('/games/:id', requireAdmin, async (req, res) => {
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

