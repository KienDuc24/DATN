const mongoose = require('mongoose');
const http = require('http');
const app = require('./server');
const attachSocket = require('./socketServer');
const PORT = process.env.PORT || 8080;

async function start() {
  try {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');

    // Fail fast if DB down
    mongoose.set('bufferCommands', false);

    // connect (remove deprecated options)
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });
    console.log('[index] connected to MongoDB');

    const server = http.createServer(app);

    // attach socket server (socketServer exports a function)
    if (typeof attachSocket === 'function') {
      attachSocket(server);
    }

    server.listen(PORT, () => {
      console.log(`[index] Server + Socket running on port ${PORT}`);
    });
  } catch (err) {
    console.error('[index] startup error', err && (err.stack || err.message));
    process.exit(1);
  }
}

start();

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('[MongoDB] Connected successfully'))
  .catch(err => console.error('[MongoDB] Connection error:', err.message));