// services/sendEmail.js (Đã chuyển sang dùng SendGrid API để khắc phục lỗi ETIMEDOUT)

const sgMail = require('@sendgrid/mail');

// Set API key from environment variable
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY; 
const EMAIL_SENDER = process.env.EMAIL_USER;

if (SENDGRID_API_KEY) {
    sgMail.setApiKey(SENDGRID_API_KEY);
}

const sendEmail = async (options) => {
  // 1. Kiểm tra cấu hình bắt buộc
  if (!SENDGRID_API_KEY || !EMAIL_SENDER) {
      console.error('CẢNH BÁO: Gửi Email bị BỎ QUA vì thiếu cấu hình SENDGRID_API_KEY hoặc EMAIL_USER.');
      throw new Error('Lỗi Gửi Email: Thiếu cấu hình SENDGRID_API_KEY/EMAIL_USER.');
  }

  // 2. Cấu hình email
  const msg = {
    to: options.email,
    from: EMAIL_SENDER, // Phải là email đã được Verify trên SendGrid
    subject: options.subject,
    html: options.message,
  };

  try {
    // 3. Chạy gửi mail bằng API
    const [response] = await sgMail.send(msg);
    
    // SendGrid trả về status 202 (Accepted) khi gửi thành công
    if (response.statusCode >= 200 && response.statusCode < 300) {
        console.log(`[Email Service - SendGrid] Gửi thành công tới: ${options.email}. Status: ${response.statusCode}`);
        return true;
    } else {
        console.error(`[Email Service - SendGrid] GỬI MAIL THẤT BẠI TỚI ${options.email}. Status: ${response.statusCode}`);
        throw new Error(`SendGrid API Error. Status: ${response.statusCode}`);
    }
  } catch (error) {
    // 4. Log lỗi chi tiết
    console.error(`[Email Service - SendGrid] LỖI GỬI MAIL:`, error.response?.body || error.message);
    // Ném lỗi lên cấp trên
    throw new Error('Lỗi Gửi Email API: Kiểm tra lại API Key và Email SENDER.');
  }
};

module.exports = sendEmail;