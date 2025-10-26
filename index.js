/**
 * index.js - bootstrap API + Socket servers with global error handlers
 */
process.on('uncaughtException', (err) => {
  console.error('[FATAL] uncaughtException:', err && (err.stack || err));
  setTimeout(() => process.exit(1), 1000);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] unhandledRejection:', reason && (reason.stack || reason));
  setTimeout(() => process.exit(1), 1000);
});

setInterval(() => {
  console.log('[diag] memUsage', process.memoryUsage());
}, 30000);

// require server/socket as usual
try { require('./server'); } catch (e) { console.error('index: server require failed', e); }
try { require('./socketServer'); } catch (e) { console.error('index: socketServer require failed', e); }