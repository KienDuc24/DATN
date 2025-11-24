const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');


router.post('/', reportController.createReport);
router.get('/', reportController.getReports);
router.get('/:id', reportController.getReportDetail);

module.exports = router;