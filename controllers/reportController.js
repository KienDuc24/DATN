const Report = require('../models/Report');

exports.createReport = async (req, res) => {
    try {
        const { reporterName, category, content } = req.body;
        const newReport = await Report.create({ reporterName, category, content });
        res.status(201).json({ message: 'Báo cáo đã được tạo.', report: newReport });
    } catch (err) {
        console.error('Lỗi tạo báo cáo:', err);
        res.status(500).json({ error: 'Lỗi server.' });
    }
};

exports.getReports = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const reports = await Report.find().skip(skip).limit(limit);
        const totalReports = await Report.countDocuments();
        const totalPages = Math.ceil(totalReports / limit);

        res.status(200).json({ reports, totalPages });
    } catch (err) {
        console.error('Lỗi lấy danh sách báo cáo:', err);
        res.status(500).json({ error: 'Lỗi server.' });
    }
};

exports.getReportDetail = async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);
        if (!report) return res.status(404).json({ error: 'Báo cáo không tồn tại.' });
        res.status(200).json(report);
    } catch (err) {
        console.error('Lỗi lấy chi tiết báo cáo:', err);
        res.status(500).json({ error: 'Lỗi server.' });
    }
};