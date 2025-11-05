const multer = require('multer');

// Configure multer to store files in memory
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Middleware to handle single file upload
module.exports = upload.single('file'); // 'file' là tên trường trong form upload