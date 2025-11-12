const axios = require('axios');

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

// Hàm hướng dẫn cách chơi
async function getGameInstructions(gameName) {
  try {
    const response = await axios.post('https://api.openai.com/v1/completions', {
      model: 'text-davinci-003',
      prompt: `Hãy hướng dẫn cách chơi trò chơi "${gameName}" một cách chi tiết.`,
      max_tokens: 200,
      temperature: 0.7,
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data.choices[0].text.trim();
  } catch (error) {
    console.error('Lỗi khi lấy hướng dẫn:', error);
    return 'Không thể lấy hướng dẫn. Vui lòng thử lại sau.';
  }
}

module.exports = { generateQuestion, getGameInstructions };