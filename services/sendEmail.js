// services/sendEmail.js (Đã cập nhật để FIX LỖI TIMEOUT bằng PORT 587)

const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // 1. Kiểm tra cấu hình bắt buộc cho OAuth2
  const requiredConfig = process.env.EMAIL_USER && 
                         process.env.GMAIL_CLIENT_ID && 
                         process.env.GMAIL_CLIENT_SECRET && 
                         process.env.GMAIL_REFRESH_TOKEN;

  if (!requiredConfig) {
      console.error('CẢNH BÁO: Gửi Email bị BỎ QUA vì thiếu cấu hình GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN.');
      // Ném lỗi lên để userController bắt
      throw new Error('Lỗi Gửi Email: Thiếu cấu hình GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN.');
  }

  // 2. Cấu hình OAuth2 TƯỜNG MINH với PORT 587 (Khắc phục ETIMEDOUT)
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', // Cố định host
    port: 587, // FIX: Sử dụng port 587 (STARTTLS)
    secure: false, // FIX: Phải là false cho port 587
    auth: {
      type: 'OAuth2',
      user: process.env.EMAIL_USER,
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
    },
    tls: {
        // Tắt kiểm tra ủy quyền (Nếu không, có thể gây lỗi SSL)
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
    throw new Error('Lỗi Gửi Email: Kết nối thất bại. Kiểm tra lại cấu hình và kết nối mạng.');
  }
};

module.exports = sendEmail;