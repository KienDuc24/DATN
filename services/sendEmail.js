// utils/sendEmail.js
const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail', // Hoặc cấu hình SMTP khác
    auth: {
      user: process.env.EMAIL_USER, // Email của bạn (trong .env)
      pass: process.env.EMAIL_PASS  // App Password của bạn (trong .env)
    }
  });

  const mailOptions = {
    from: `"Camping Game Support" <${process.env.EMAIL_USER}>`,
    to: options.email,
    subject: options.subject,
    html: options.message
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;