require('dotenv').config();
const http = require('http');

console.log('[index] starting - FRONTEND_URL=', !!process.env.FRONTEND_URL, 'MONGO_URI=', !!process.env.MONGO_URI);

const app = require('./server'); // server.js should ONLY export express app
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

process.on('uncaughtException', (err) => console.error('[index][FATAL] uncaughtException', err && err.stack || err));
process.on('unhandledRejection', (reason) => console.error('[index][FATAL] unhandledRejection', reason && reason.stack || reason));