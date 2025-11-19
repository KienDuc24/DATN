// services/sendEmail.js (Đã sửa lỗi cấu hình SMTP và thêm log chi tiết)

const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // 1. Kiểm tra cấu hình môi trường
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn('CẢNH BÁO: Gửi Email bị BỎ QUA vì thiếu EMAIL_USER hoặc EMAIL_PASS trong .env.');
      return; 
  }

  // 2. Sử dụng cấu hình SMTP tường minh (tin cậy hơn service: 'gmail')
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: 465, 
    secure: true, // Bắt buộc phải là true khi dùng port 465
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS // PHẢI LÀ Mật khẩu Ứng dụng (App Password)
    },
    // Thêm tùy chọn xác minh kết nối (giúp chẩn đoán lỗi)
    tls: {
        rejectUnauthorized: false
    }
  });

  const mailOptions = {
    from: `${process.env.EMAIL_USER}`,
    to: options.email,
    subject: options.subject,
    html: options.message,
  };

  try {
    // 3. Chạy gửi mail
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email Service] Gửi thành công tới: ${options.email}. ID: ${info.messageId}`);
  } catch (error) {
    // 4. Log chi tiết lỗi Nodemailer
    console.error(`[Email Service] GỬI MAIL THẤT BẠI TỚI ${options.email}:`, error);
    // Quan trọng: Ném lỗi lên cấp trên để userController có thể bắt và trả về 500
    throw new Error('Lỗi Gửi Email: Vui lòng kiểm tra lại EMAIL_PASS hoặc log server.');
  }
};

module.exports = sendEmail;