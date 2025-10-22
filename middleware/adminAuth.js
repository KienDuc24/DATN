module.exports = function adminAuth(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return res.status(500).json({ ok: false, message: 'ADMIN not configured' });

  const val = req.cookies && req.cookies.admin_auth;
  if (val === secret) return next();

  // nếu request HTML cho admin, redirect tới trang login
  if (req.method === 'GET' && req.path.startsWith('/admin')) return res.redirect('/admin-login.html');

  return res.status(401).json({ ok: false, message: 'Unauthorized' });
};