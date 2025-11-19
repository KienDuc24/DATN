// services/sendEmail.js

const nodemailer = require('nodemailer'); // Import Nodemailer

const sendEmail = async (options) => {
  // FIX: Sửa lỗi tham chiếu và đảm bảo createTransport được gọi
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: 465, // Port cho SSL/TLS
    secure: true, // true cho port 465, false cho các port khác
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS // Mật khẩu Ứng dụng (App Password)
    }
  });

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn('Cảnh báo: EMAIL_USER hoặc EMAIL_PASS chưa được đặt. Bỏ qua gửi email.');
      return; // Không gửi nếu thiếu cấu hình
  }

  const mailOptions = {
    from: `${process.env.EMAIL_USER}`,
    to: options.email,
    subject: options.subject,
    html: options.message,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;