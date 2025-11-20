// services/sendEmail.js (Cập nhật sử dụng biến GMAIL_XXX)

const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // 1. Kiểm tra cấu hình bắt buộc cho OAuth2
  const requiredConfig = process.env.EMAIL_USER && 
                         process.env.GMAIL_CLIENT_ID && 
                         process.env.GMAIL_CLIENT_SECRET && 
                         process.env.GMAIL_REFRESH_TOKEN;

  if (!requiredConfig) {
      console.error('CẢNH BÁO: Gửi Email bị BỎ QUA. Thiếu cấu hình GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN.');
      // Ném lỗi để hàm forgotPassword bắt và không lưu token
      throw new Error('Lỗi Gửi Email: Thiếu cấu hình GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN.');
  }

  // 2. Sử dụng cấu hình OAuth2 với biến mới
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.EMAIL_USER,
      // SỬ DỤNG BIẾN MỚI CHO MAIL
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
    },
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
    // 4. Log lỗi chi tiết
    console.error(`[Email Service] GỬI MAIL THẤT BẠI TỚI ${options.email}:`, error);
    // Ném lỗi lên cấp trên
    throw new Error(`Lỗi Gửi Email: Vui lòng kiểm tra lại GMAIL_REFRESH_TOKEN.`);
  }
};

module.exports = sendEmail;