const axios = require('axios');
const fs = require('fs');
const path = require('path');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // Đặt API Key trong file .env

// Hàm tạo câu hỏi dựa trên gợi ý
async function generateQuestion(prompt) {
  try {
    const response = await axios.post('https://api.openai.com/v1/completions', {
      model: 'text-davinci-003',
      prompt: `Hãy tạo một câu hỏi cho trò chơi "Truth or Dare" dựa trên gợi ý sau: "${prompt}"`,
      max_tokens: 100,
      temperature: 0.7,
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data.choices[0].text.trim();
  } catch (error) {
    console.error('Lỗi khi tạo câu hỏi:', error);
    return 'Không thể tạo câu hỏi. Vui lòng thử lại sau.';
  }
}

// Hàm đọc luật chơi từ rule.json
async function getGameInstructions(gameName) {
  try {
    const filePath = path.join(__dirname, '../public/game/ToD/rule.json'); // Đường dẫn đến rule.json
    const rules = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    // Kiểm tra tên trò chơi và trả về nội dung phù hợp
    if (gameName === rules.game_name_en || gameName === rules.game_name_vi) {
      return `
        Tên trò chơi: ${rules.game_name_vi} (${rules.game_name_en})
        Tóm tắt: ${rules.rules_summary}
        Luật chơi:
        - ${rules.turn_mechanics.start}
        - ${rules.turn_mechanics.flow}
        - ${rules.turn_mechanics.completion}
        Hệ thống đánh giá:
        - Mục đích: ${rules.voting_system.purpose}
        - Kết quả thành công: ${rules.voting_system.result_success}
        - Kết quả thất bại: ${rules.voting_system.result_failure}
      `;
    } else {
      return 'Không tìm thấy hướng dẫn cho trò chơi này.';
    }
  } catch (error) {
    console.error('Lỗi khi đọc hướng dẫn:', error);
    return 'Không thể lấy hướng dẫn. Vui lòng thử lại sau.';
  }
}

module.exports = { generateQuestion, getGameInstructions };