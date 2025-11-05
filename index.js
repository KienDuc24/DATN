require('dotenv').config();
const http = require('http');

console.log('[index] starting - FRONTEND_URL=', !!process.env.FRONTEND_URL, 'MONGODB_URI=', !!process.env.MONGODB_URI);

const app = require('./server');
let server; // declare so handlers can reference

// Graceful shutdown helper
function gracefulShutdown(signal) {
  console.log(`[index] Received ${signal}, starting graceful shutdown...`);
  if (!server) {
    console.log('[index] no server instance, exiting now');
    return process.exit(0);
  }

  // stop accepting new connections
  server.close((err) => {
    if (err) {
      console.error('[index] error closing server', err && err.stack || err);
      return process.exit(1);
    }
    console.log('[index] server closed gracefully');
    process.exit(0);
  });

  // Force exit after timeout (Railway may enforce a hard timeout)
  setTimeout(() => {
    console.error('[index] graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 10_000).unref(); // 10s, adjust if needed
}

// register handlers early
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  console.error('[index][FATAL] uncaughtException', err && err.stack || err);
  gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  console.error('[index][FATAL] unhandledRejection', reason && reason.stack || reason);
  // optionally call gracefulShutdown or let process continue
});

// create server and attach socket
const PORT = process.env.PORT || 3000;
server = http.createServer(app);

try {
  const { socketServer } = require('./socketServer');
  socketServer(server);
  console.log('[index] socketServer attached');
} catch (e) {
  console.error('[index] failed to attach socketServer', e && e.stack || e);
}

server.listen(PORT, () => console.log(`[index] Server + Socket running on port ${PORT}`));