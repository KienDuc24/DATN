// public/chatbot.js
// Logic AI Chatbot dùng chung cho index.html và room.html

(function() {
  // Lấy API_BASE_URL từ biến toàn cục (do script.js hoặc room.js định nghĩa)
  const API_BASE_URL = window.BASE_API || window.SOCKET_URL || 'https://datn-socket.up.railway.app';

  const aiToolsIcon = document.getElementById('ai-tools-icon');
  const aichatbot = document.getElementById('ai-chatbot');
  const chatInput = document.getElementById('chatInput');
  const sendChat = document.getElementById('sendChat');
  const chatMessages = document.getElementById('chatMessages');
  const closechatbot = document.getElementById('closechatbot');

  if (!aiToolsIcon || !aichatbot || !chatInput || !sendChat || !chatMessages || !closechatbot) {
      console.warn('AI chatbot elements not found. Skipping AI chat logic.');
      return;
  }

  // --- HÀM MỚI: Tự động phát hiện bối cảnh (Context) ---
  function getChatbotContext() {
    const pathname = window.location.pathname;
    
    if (pathname.endsWith('/room.html')) {
        // Chúng ta đang ở phòng chờ
        const gameId = new URLSearchParams(window.location.search).get('gameId');
        return {
            page: 'room',
            gameId: gameId || null, // Ví dụ: 'ToD', 'Draw'
        };
    } else {
        // Chúng ta đang ở trang chủ
        return {
            page: 'index',
            gameId: 'all', // Gửi 'all' để AI biết đây là trang chủ
        };
    }
  }

  const context = getChatbotContext();
  if (!context.gameId) {
      console.warn('Chatbot không thể xác định gameId (trang room.html).');
  }

  // --- HÀM MỚI: Thêm nút gợi ý dựa trên bối cảnh ---
  function addSuggestionButtons() {
    if (document.getElementById('chat-suggestions')) return;

    const suggestionsEl = document.createElement('div');
    suggestionsEl.id = 'chat-suggestions';
    suggestionsEl.className = 'chat-suggestions';
    
    if (context.page === 'room') {
        // Gợi ý cho phòng chờ
        suggestionsEl.innerHTML = `
            <button class="suggestion-btn" data-question="Mô tả game này">Mô tả game <i class="fas fa-info-circle"></i></button>
            <button class="suggestion-btn" data-question="Cách chơi game này thế nào?">Giải thích luật chơi <i class="fas fa-book"></i></button>
        `;
    } else {
        // Gợi ý cho trang chủ
        suggestionsEl.innerHTML = `
            <button class="suggestion-btn" data-question="Bạn có những game gì?">Giới thiệu các game <i class="fas fa-gamepad"></i></button>
            <button class="suggestion-btn" data-action="login">Đăng nhập / Đăng ký <i class="fas fa-user-circle"></i></button>
        `;
    }
    
    chatMessages.appendChild(suggestionsEl);

    // Thêm sự kiện click
    suggestionsEl.querySelectorAll('.suggestion-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const question = btn.getAttribute('data-question');
            const action = btn.getAttribute('data-action');

            if (question) {
                // Nếu là câu hỏi, gửi đi
                handleSendChat(question); 
            } else if (action === 'login') {
                // Nếu là hành động, thực thi hàm (hàm này đã có sẵn trong script.js)
                if (typeof openAuthModal === 'function') {
                    openAuthModal('login');
                    aichatbot.classList.add('hidden'); // Ẩn bot đi
                } else {
                    console.error('Lỗi: Không tìm thấy hàm openAuthModal() trên trang này.');
                }
                removeSuggestionButtons();
            }
        });
    });
  }

  // Hàm xóa nút lựa chọn
  function removeSuggestionButtons() {
    const suggestionsEl = document.getElementById('chat-suggestions');
    if (suggestionsEl) {
        suggestionsEl.remove();
    }
  }

  aiToolsIcon.addEventListener('click', () => {
    aichatbot.classList.toggle('hidden');
    if (!aichatbot.classList.contains('hidden') && !chatMessages.querySelector('.chat-message')) {
        const welcomeMsg = context.page === 'room' 
            ? '🤖 Chào bạn. Tôi có thể giúp gì về game này?'
            : '🤖 Chào bạn. Tôi là trợ lý AI của Camping Game.';
        addMessageToChat(welcomeMsg, 'ai');
        addSuggestionButtons(); // Thêm nút
    }
  });

  closechatbot.addEventListener('click', () => {
    aichatbot.classList.add('hidden');
  });
  
  function addMessageToChat(text, sender) {
    if (!chatMessages) return;
    if (sender === 'user') {
        removeSuggestionButtons();
    }
    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${sender}`; 
    messageEl.textContent = text;
    chatMessages.appendChild(messageEl);
    chatMessages.scrollTop = chatMessages.scrollHeight; 
    return messageEl;
  }

  async function getInstructionsFromAI(question) {
    const normalizedQuestion = String(question || '').trim();
    if (!normalizedQuestion) return '❌ Vui lòng nhập câu hỏi hợp lệ.';
    
    if (!context.gameId) {
        return '❌ Lỗi: Không thể xác định mã game (gameId) để hỏi AI.';
    }

    const endpoint = `${API_BASE_URL}/api/ai/ask`; 
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            question: normalizedQuestion,
            gameId: context.gameId // Gửi gameId (ví dụ: 'all' hoặc 'ToD')
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        return payload?.error || `❌ API trả về lỗi (${response.status}).`;
      }
      if (typeof payload?.answer === 'string' && payload.answer.trim()) {
        return payload.answer.trim();
      }
      return '❌ Server không trả về câu trả lời hợp lệ.';
    } catch (error) {
      console.error('[AI Chatbot] Request failed', endpoint, error);
      return '❌ Lỗi kết nối đến máy chủ AI.';
    }
  }

  async function handleSendChat(predefinedQuestion = null) {
    const question = predefinedQuestion || chatInput.value.trim();
    if (!question) return;
    
    chatInput.disabled = true;
    sendChat.disabled = true;
    removeSuggestionButtons();
    
    addMessageToChat(question, 'user');
    chatInput.value = ''; 

    const loaderMessage = addMessageToChat('🤖 Đang suy nghĩ...', 'ai loader');
    const aiResponse = await getInstructionsFromAI(question);
    loaderMessage.remove(); 
    addMessageToChat(aiResponse, 'ai'); 

    chatInput.disabled = false;
    sendChat.disabled = false;
    chatInput.focus();
  }
  
  sendChat.addEventListener('click', () => handleSendChat(null)); 
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { // Thêm: Chặn gửi bằng Shift+Enter
      e.preventDefault(); // Ngăn xuống dòng
      handleSendChat(null);
    }
  });

})();
