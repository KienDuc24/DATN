const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const { isAdmin } = require('../middleware/adminAuth'); 


router.post('/', async (req, res) => {
  try {
    const { reporterName, category, content } = req.body;
    if (!category || !content) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin.' });
    }
    const newReport = new Report({ reporterName, category, content });
    await newReport.save();
    res.status(201).json({ message: 'Báo cáo đã được gửi thành công.' });
  } catch (error) {
    console.error('Lỗi lưu báo cáo:', error);
    res.status(500).json({ error: 'Lỗi server khi lưu báo cáo.' });
  }
});


router.get('/admin', isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const reports = await Report.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Report.countDocuments();

    res.json({
      reports,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalReports: total
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách báo cáo:', error);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

router.get('/admin/:id', isAdmin, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Không tìm thấy báo cáo.' });
    res.json(report);
  } catch (error) {
    console.error('Lỗi lấy chi tiết báo cáo:', error);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

router.put('/admin/:id', isAdmin, async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status, adminNote },
      { new: true } 
    );
    if (!report) return res.status(404).json({ error: 'Không tìm thấy báo cáo.' });
    res.json(report);
  } catch (error) {
    console.error('Lỗi cập nhật báo cáo:', error);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

module.exports = router;