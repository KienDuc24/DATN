const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function (req, res, next) {
  try {
    const auth = req.headers.authorization || req.cookies && req.cookies.token;
    if (!auth) return res.status(401).json({ error: 'No token' });
    const token = auth.startsWith('Bearer ') ? auth.split(' ')[1] : auth;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ error: 'Invalid token' });
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};