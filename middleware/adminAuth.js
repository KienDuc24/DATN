const jwt = require('jsonwebtoken');

const adminAuth = (req, res, next) => {
  const token = req.cookies.admin_token;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.ADMIN_SECRET);
    req.user = decoded; 
    next(); 
  } catch (ex) {
    res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};

module.exports = adminAuth;