/**
 * index.js - bootstrap API + Socket servers with global error handlers
 */
// Global bootstrap: start server & socket, add diagnostics and graceful shutdown
process.on('uncaughtException', (err) => {
  console.error('[FATAL] uncaughtException:', err && (err.stack || err));
  // allow logs to flush
  setTimeout(() => process.exit(1), 1000);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] unhandledRejection:', reason && (reason.stack || reason));
  setTimeout(() => process.exit(1), 1000);
});

// diagnostic memory snapshots
const MEM_LOG_INTERVAL = 30 * 1000;
const memInterval = setInterval(() => {
  try {
    console.log('[diag] memUsage', process.memoryUsage());
  } catch (e) {
    console.warn('[diag] mem log error', e && e.message);
  }
}, MEM_LOG_INTERVAL);

function gracefulShutdown() {
  console.log('[signal] SIGTERM/SIGINT received - shutting down');
  clearInterval(memInterval);
  try {
    const srv = require('./server');
    if (srv && srv.server && typeof srv.server.close === 'function') {
      srv.server.close(() => {
        console.log('[signal] HTTP server closed');
        process.exit(0);
      });
      // force exit if not closed in time
      setTimeout(() => process.exit(0), 5000);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('[signal] shutdown err', err && err.message);
    process.exit(1);
  }
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// require server + socket modules (server starts listening)
try {
  require('./server');
  console.log('index.js: server module loaded');
} catch (e) {
  console.error('index.js: failed to load server module', e && e.message);
}

try {
  require('./socketServer');
  console.log('index.js: socketServer loaded');
} catch (e) {
  console.error('index.js: failed to load socketServer', e && e.message);
}