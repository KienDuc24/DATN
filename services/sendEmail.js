const sgMail = require('@sendgrid/mail');

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY; 
const EMAIL_SENDER = process.env.EMAIL_USER;

if (SENDGRID_API_KEY) {
    sgMail.setApiKey(SENDGRID_API_KEY);
}

const sendEmail = async (options) => {
  if (!SENDGRID_API_KEY || !EMAIL_SENDER) {
      console.error('CẢNH BÁO: Gửi Email bị BỎ QUA vì thiếu cấu hình SENDGRID_API_KEY hoặc EMAIL_USER.');
      throw new Error('Lỗi Gửi Email: Thiếu cấu hình SENDGRID_API_KEY/EMAIL_USER.');
  }

  const msg = {
    to: options.email,
    from: EMAIL_SENDER, 
    subject: options.subject,
    html: options.message,
  };

  try {
    const [response] = await sgMail.send(msg);
        if (response.statusCode >= 200 && response.statusCode < 300) {
        console.log(`[Email Service - SendGrid] Gửi thành công tới: ${options.email}. Status: ${response.statusCode}`);
        return true;
    } else {
        console.error(`[Email Service - SendGrid] GỬI MAIL THẤT BẠI TỚI ${options.email}. Status: ${response.statusCode}`);
        throw new Error(`SendGrid API Error. Status: ${response.statusCode}`);
    }
  } catch (error) {
    console.error(`[Email Service - SendGrid] LỖI GỬI MAIL:`, error.response?.body || error.message);
    throw new Error('Lỗi Gửi Email API: Kiểm tra lại API Key và Email SENDER.');
  }
};

module.exports = sendEmail;