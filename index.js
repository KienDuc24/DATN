require('dotenv').config();
const http = require('http');

console.log('[index] NODE_ENV=', process.env.NODE_ENV, 'FRONTEND_URL=', !!process.env.FRONTEND_URL, 'MONGODB_URI=', !!process.env.MONGODB_URI);

const app = require('./server');
const server = http.createServer(app);

try {
  const { socketServer } = require('./socketServer');
  socketServer(server);
  console.log('[index] socketServer attached');
} catch (e) {
  console.error('[index] failed to attach socketServer', e && e.stack || e);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`[index] Server + Socket running on port ${PORT}`));

process.on('uncaughtException', (err) => console.error('[FATAL] uncaughtException', err && err.stack || err));
process.on('unhandledRejection', (reason) => console.error('[FATAL] unhandledRejection', reason));