/**
 * index.js - bootstrap both API and Socket servers, add global error handlers
 */

process.on('uncaughtException', (err) => {
  console.error('[FATAL] uncaughtException:', err && (err.stack || err));
  // allow logs to flush then exit so the platform restarts cleanly
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] unhandledRejection:', reason && (reason.stack || reason));
  setTimeout(() => process.exit(1), 1000);
});

// function to attempt graceful shutdown
async function gracefulShutdown() {
  console.log('[signal] starting graceful shutdown');
  try {
    // try to close http server and socket.io if available
    const srv = require('./server');
    if (srv && srv.server && typeof srv.server.close === 'function') {
      srv.server.close(() => console.log('[signal] HTTP server closed'));
    }
    // if socketServer exports io, try close it
    try {
      const io = require('./socketServer');
      if (io && typeof io.close === 'function') {
        io.close();
        console.log('[signal] Socket.IO closed');
      }
    } catch (err) {
      // socket may be attached to server module; ignore if require fails
    }
  } catch (err) {
    console.warn('[signal] shutdown error:', err && err.message);
  } finally {
    // force exit after short delay
    setTimeout(() => process.exit(0), 3000);
  }
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start servers (require order: server first so socketServer can reuse exported server)
try {
  require('./server');
} catch (err) {
  console.error('index.js: failed to start server.js (API):', err && err.message);
}
try {
  require('./socketServer');
} catch (err) {
  console.error('index.js: failed to start socketServer.js (socket):', err && err.message);
}