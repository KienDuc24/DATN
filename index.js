process.on('uncaughtException', (err) => {
  console.error('[FATAL] uncaughtException:', err && (err.stack || err));
  // optional: flush logs, then exit after short delay
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] unhandledRejection:', reason && (reason.stack || reason));
});

process.on('SIGTERM', () => {
  console.log('[signal] SIGTERM received - shutting down gracefully');
  // if you export server, close it:
  try {
    const srv = require('./server');
    if (srv && srv.server && srv.server.close) {
      srv.server.close(() => {
        console.log('[signal] HTTP server closed');
        process.exit(0);
      });
      // force exit after timeout
      setTimeout(() => process.exit(0), 5000);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('[signal] error closing server:', err && err.message);
    process.exit(1);
  }
});

// then require/start servers
try {
  require('./server');
} catch (err) {
  console.warn('index.js: failed to start server.js (API):', err && err.message);
}
try {
  require('./socketServer');
} catch (err) {
  console.warn('index.js: failed to start socketServer.js:', err && err.message);
}