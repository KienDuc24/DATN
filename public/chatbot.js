// public/chatbot.js (FINAL: Đa ngôn ngữ động + API chuẩn + Avatar DiceBear)

document.addEventListener("DOMContentLoaded", () => {
    // 1. Tạo HTML cho Chatbot
    const chatbotContainer = document.createElement("div");
    chatbotContainer.id = "chatbot-container";
    chatbotContainer.innerHTML = `
        <div id="chatbot-icon">
            <img src="https://api.dicebear.com/7.x/bottts/svg?seed=Assistant" alt="AI">
        </div>
        <div id="chatbot-window" class="hidden">
            <div id="chatbot-header">
                <div class="header-info">
                    <img src="https://api.dicebear.com/7.x/bottts/svg?seed=Assistant" alt="Bot Avatar">
                    <span id="chat-title-text">Trợ lý AI</span>
                </div>
                <button id="chatbot-close">&times;</button>
            </div>
            <div id="chatbot-messages"></div>
            <div id="chatbot-input-area">
                <input type="text" id="chatbot-input" placeholder="Hỏi gì đó...">
                <button id="chatbot-send">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(chatbotContainer);

    // 2. Các biến DOM
    const chatIcon = document.getElementById("chatbot-icon");
    const chatWindow = document.getElementById("chatbot-window");
    const closeBtn = document.getElementById("chatbot-close");
    const sendBtn = document.getElementById("chatbot-send");
    const inputField = document.getElementById("chatbot-input");
    const messagesArea = document.getElementById("chatbot-messages");
    const titleText = document.getElementById("chat-title-text");
    
    const API_BASE_URL = window.BASE_API || 'https://datn-socket.up.railway.app';

    // 3. Xác định ngữ cảnh (Context)
    function getChatbotContext() {
        const pathname = window.location.pathname;
        if (pathname.endsWith('/room.html') || pathname.includes('/game/')) {
            const gameId = new URLSearchParams(window.location.search).get('gameId');
            return { page: 'room', gameId: gameId || 'all' };
        }
        return { page: 'index', gameId: 'all' };
    }

    // 4. Xử lý Đa ngôn ngữ
    let LANGS = {};

    async function loadChatLanguage() {
        try {
            const res = await fetch('/lang.json');
            LANGS = await res.json();
            // Không gọi applyLanguage() ngay ở đây để tránh xung đột
        } catch (e) {
            console.error("Chatbot: Không tải được ngôn ngữ", e);
        }
    }

    // Lấy ngôn ngữ hiện tại từ localStorage
    function getCurrentLang() {
        return localStorage.getItem('lang') || 'vi';
    }

    function t(key, defaultText) {
        const lang = getCurrentLang();
        return LANGS[lang]?.[key] || defaultText || key;
    }

    function applyLanguage() {
        titleText.innerText = t('chat_title', 'Trợ lý AI');
        inputField.placeholder = t('chat_placeholder', 'Hỏi gì đó...');
    }

    loadChatLanguage(); 

    // 5. Xử lý Avatar DiceBear
    function getAvatarUrl(type, username) {
        if (type === 'bot') {
            return `https://api.dicebear.com/7.x/bottts/svg?seed=Assistant`; 
        }
        const safeName = username || 'guest';
        return `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(safeName)}`;
    }

    function getUserName() {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            return user.username || 'guest';
        } catch { return 'guest'; }
    }

    // --- 6. LOGIC GỢI Ý (SUGGESTIONS) ---
    function addSuggestionButtons() {
        const oldSuggestions = document.getElementById('chat-suggestions');
        if (oldSuggestions) oldSuggestions.remove();

        const context = getChatbotContext();
        const suggestionsEl = document.createElement('div');
        suggestionsEl.id = 'chat-suggestions';
        suggestionsEl.className = 'chat-suggestions';
        
        // Nội dung gợi ý phụ thuộc vào ngôn ngữ hiện tại
        const lang = getCurrentLang();
        
        if (context.page === 'room') {
            const btn1Text = lang === 'vi' ? 'Mô tả game này' : 'Describe this game';
            const btn2Text = lang === 'vi' ? 'Luật chơi thế nào?' : 'How to play?';
            
            suggestionsEl.innerHTML = `
                <button class="suggestion-btn" data-question="${btn1Text}">${btn1Text} <i class="fas fa-info-circle"></i></button>
                <button class="suggestion-btn" data-question="${btn2Text}">${btn2Text} <i class="fas fa-book"></i></button>
            `;
        } else {
            const btn1Text = lang === 'vi' ? 'Giới thiệu các game' : 'Introduce games';
            const btn2Text = lang === 'vi' ? 'Đăng nhập / Đăng ký' : 'Login / Register';

            suggestionsEl.innerHTML = `
                <button class="suggestion-btn" data-question="${btn1Text}">${btn1Text} <i class="fas fa-gamepad"></i></button>
                <button class="suggestion-btn" data-action="login">${btn2Text} <i class="fas fa-user-circle"></i></button>
            `;
        }
        
        messagesArea.appendChild(suggestionsEl);
        messagesArea.scrollTop = messagesArea.scrollHeight;

        suggestionsEl.querySelectorAll('.suggestion-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const question = btn.getAttribute('data-question');
                const action = btn.getAttribute('data-action');

                if (question) {
                    handleChat(question); 
                } else if (action === 'login') {
                    if (typeof openAuthModal === 'function') {
                        openAuthModal('login');
                        chatWindow.classList.add('hidden'); 
                        chatIcon.classList.remove("hidden");
                    } else {
                        alert('Chức năng này chưa sẵn sàng ở đây.');
                    }
                    removeSuggestionButtons();
                }
            });
        });
    }

    function removeSuggestionButtons() {
        const suggestionsEl = document.getElementById('chat-suggestions');
        if (suggestionsEl) suggestionsEl.remove();
    }

    // 7. Logic Chat Chính
    chatIcon.addEventListener("click", () => {
        // Cập nhật ngôn ngữ mỗi khi mở box chat
        applyLanguage();
        
        chatWindow.classList.remove("hidden");
        chatIcon.classList.add("hidden");
        inputField.focus();

        // Nếu chưa có tin nhắn, hiện chào mừng và gợi ý THEO NGÔN NGỮ HIỆN TẠI
        if (messagesArea.querySelectorAll('.message').length === 0) {
            const welcomeText = t('chat_welcome', 'Xin chào! Tôi là AI. Tôi có thể giúp gì cho bạn hôm nay?');
            addMessage('bot', welcomeText);
            setTimeout(addSuggestionButtons, 500); 
        }
    });

    closeBtn.addEventListener("click", () => {
        chatWindow.classList.add("hidden");
        chatIcon.classList.remove("hidden");
    });

    function addMessage(sender, text) {
        if (sender === 'user') removeSuggestionButtons();

        const msgDiv = document.createElement("div");
        msgDiv.classList.add("message", sender);
        
        const avatarUrl = getAvatarUrl(sender, getUserName());
        
        msgDiv.innerHTML = `
            <img src="${avatarUrl}" class="chat-avatar" alt="${sender}">
            <div class="bubble">${text}</div>
        `;
        
        messagesArea.appendChild(msgDiv);
        messagesArea.scrollTop = messagesArea.scrollHeight;
        return msgDiv;
    }

    async function handleChat(manualText = null) {
        const text = manualText || inputField.value.trim();
        if (!text) return;

        addMessage("user", text);
        inputField.value = "";
        inputField.disabled = true;

        const loadingDiv = document.createElement("div");
        loadingDiv.className = "message bot loading";
        loadingDiv.innerHTML = `<img src="${getAvatarUrl('bot')}" class="chat-avatar"><div class="bubble">...</div>`;
        messagesArea.appendChild(loadingDiv);
        messagesArea.scrollTop = messagesArea.scrollHeight;

        try {
            const context = getChatbotContext();
            
            const response = await fetch(`${API_BASE_URL}/api/ai/ask`, { 
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    question: text,
                    gameId: context.gameId
                })
            });

            const data = await response.json();
            messagesArea.removeChild(loadingDiv);
            
            if (!response.ok) throw new Error(data.error || "Lỗi server");

            addMessage("bot", data.answer || "Xin lỗi, tôi không hiểu câu hỏi.");

        } catch (error) {
            console.error("Chat error:", error);
            if(document.body.contains(loadingDiv)) messagesArea.removeChild(loadingDiv);
            addMessage("bot", "Không thể kết nối tới máy chủ AI.");
        } finally {
            inputField.disabled = false;
            inputField.focus();
        }
    }

    sendBtn.addEventListener("click", () => handleChat());
    inputField.addEventListener("keypress", (e) => {
        if (e.key === "Enter") handleChat();
    });
});