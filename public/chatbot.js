// public/chatbot.js (FULL: Sync History + Smart Suggestions + Personalization)

document.addEventListener("DOMContentLoaded", () => {
    // 1. Render HTML
    const chatbotContainer = document.createElement("div");
    chatbotContainer.id = "chatbot-container";
    chatbotContainer.innerHTML = `
        <div id="chatbot-icon">
            <img src="https://api.dicebear.com/7.x/bottts/svg?seed=Assistant" alt="AI">
        </div>
        <div id="chatbot-window" class="hidden">
            <div id="chatbot-header">
                <div class="header-info">
                    <img src="https://api.dicebear.com/7.x/bottts/svg?seed=Assistant" alt="Bot">
                    <span id="chat-title-text">Trợ lý AI</span>
                </div>
                <div class="header-actions" style="display:flex;gap:10px;align-items:center;">
                    <button id="chatbot-reset" title="Xóa lịch sử" style="background:none;border:none;color:rgba(255,255,255,0.7);font-size:1.2rem;cursor:pointer;">↺</button>
                    <button id="chatbot-close">&times;</button>
                </div>
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

    // 2. DOM Elements
    const chatIcon = document.getElementById("chatbot-icon");
    const chatWindow = document.getElementById("chatbot-window");
    const closeBtn = document.getElementById("chatbot-close");
    const resetBtn = document.getElementById("chatbot-reset");
    const sendBtn = document.getElementById("chatbot-send");
    const inputField = document.getElementById("chatbot-input");
    const messagesArea = document.getElementById("chatbot-messages");
    const titleText = document.getElementById("chat-title-text");
    
    const API_BASE_URL = window.BASE_API || 'https://datn-socket.up.railway.app';

    // --- 3. QUẢN LÝ LỊCH SỬ (STORAGE) ---
    function loadHistory() {
        try {
            const history = JSON.parse(sessionStorage.getItem('chat_history') || '[]');
            if (history.length > 0) {
                history.forEach(msg => {
                    // False = chỉ hiện lên UI, không lưu lại lần nữa
                    addMessageToUI(msg.sender, msg.text, false); 
                });
                // Cuộn xuống cuối sau khi load
                setTimeout(() => messagesArea.scrollTop = messagesArea.scrollHeight, 100);
                return true; 
            }
        } catch (e) { console.error('History load error', e); }
        return false; 
    }

    function saveToHistory(sender, text) {
        try {
            const history = JSON.parse(sessionStorage.getItem('chat_history') || '[]');
            history.push({ sender, text });
            if (history.length > 50) history.shift(); // Giới hạn 50 tin
            sessionStorage.setItem('chat_history', JSON.stringify(history));
        } catch (e) { console.error('History save error', e); }
    }

    function clearHistory() {
        sessionStorage.removeItem('chat_history');
        messagesArea.innerHTML = '';
        // Reset lại trạng thái ban đầu
        initWelcome();
    }
    
    resetBtn.addEventListener('click', () => {
        if(confirm('Xóa toàn bộ cuộc trò chuyện?')) clearHistory();
    });

    // 4. Context & Auth Helpers
    function getChatbotContext() {
        const pathname = window.location.pathname;
        if (pathname.endsWith('/room.html') || pathname.includes('/game/')) {
            const gameId = new URLSearchParams(window.location.search).get('gameId');
            return { page: 'room', gameId: gameId || 'all' };
        }
        return { page: 'index', gameId: 'all' };
    }

    function getUserInfo() {
        try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
    }

    function isRealUser() {
        const user = getUserInfo();
        return user.username && !user.isGuest && !user.username.startsWith('guest_');
    }

    function getUserDisplayName() {
        const user = getUserInfo();
        return user.displayName || user.username || 'Bạn';
    }

    function getUserName() {
        return getUserInfo().username || 'guest';
    }

    // 5. Multi-language
    let LANGS = {};
    async function loadChatLanguage() {
        try {
            const res = await fetch('/lang.json');
            LANGS = await res.json();
        } catch (e) {}
    }
    function getCurrentLang() { return localStorage.getItem('lang') || 'vi'; }
    function t(key, defaultText) {
        const lang = getCurrentLang();
        return LANGS[lang]?.[key] || defaultText || key;
    }
    function applyLanguage() {
        titleText.innerText = t('chat_title', 'Trợ lý AI');
        inputField.placeholder = t('chat_placeholder', 'Hỏi gì đó...');
    }
    loadChatLanguage(); 

    // 6. Avatar
    function getAvatarUrl(type, username) {
        if (type === 'bot') return `https://api.dicebear.com/7.x/bottts/svg?seed=Assistant`; 
        const safeName = username || 'guest';
        return `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(safeName)}`;
    }

    // 7. --- LOGIC GỢI Ý (SUGGESTIONS) ---
    function addSuggestionButtons() {
        const oldSuggestions = document.getElementById('chat-suggestions');
        if (oldSuggestions) oldSuggestions.remove();

        const context = getChatbotContext();
        const suggestionsEl = document.createElement('div');
        suggestionsEl.id = 'chat-suggestions';
        suggestionsEl.className = 'chat-suggestions';
        
        const lang = getCurrentLang();
        let buttonsHTML = '';

        if (context.page === 'room') {
            // Phòng game: 2 gợi ý
            const btn1 = lang === 'vi' ? 'Mô tả game này' : 'Describe this game';
            const btn2 = lang === 'vi' ? 'Luật chơi thế nào?' : 'How to play?';
            buttonsHTML += `<button class="suggestion-btn" data-question="${btn1}">${btn1} <i class="fas fa-info-circle"></i></button>`;
            buttonsHTML += `<button class="suggestion-btn" data-question="${btn2}">${btn2} <i class="fas fa-book"></i></button>`;
        } else {
            // Trang chủ: 2 hoặc 3 gợi ý
            const btnList = lang === 'vi' ? 'Bạn có những game gì?' : 'List available games';
            const btnFind = lang === 'vi' ? 'Tìm game theo yêu cầu' : 'Find game by requirement';
            
            buttonsHTML += `<button class="suggestion-btn" data-question="${btnList}">${btnList} <i class="fas fa-list"></i></button>`;
            buttonsHTML += `<button class="suggestion-btn" data-question="${btnFind}">${btnFind} <i class="fas fa-search"></i></button>`;
            
            if (!isRealUser()) {
                const btnLogin = lang === 'vi' ? 'Đăng nhập / Đăng ký' : 'Login / Register';
                buttonsHTML += `<button class="suggestion-btn" data-action="login">${btnLogin} <i class="fas fa-user-circle"></i></button>`;
            }
        }
        
        suggestionsEl.innerHTML = buttonsHTML;
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

    // Hàm khởi tạo lời chào (dùng khi mở lần đầu hoặc reset)
    function initWelcome() {
        const displayName = getUserDisplayName();
        const lang = getCurrentLang();
        const welcomeText = lang === 'vi' 
            ? `Xin chào ${displayName}! Tôi là AI hỗ trợ. Tôi có thể giúp gì cho bạn?`
            : `Hello ${displayName}! I am AI Assistant. How can I help you?`;
        
        addMessageToUI('bot', welcomeText, true);
        setTimeout(addSuggestionButtons, 500);
    }

    // 8. Logic Chat Chính
    chatIcon.addEventListener("click", () => {
        applyLanguage();
        chatWindow.classList.remove("hidden");
        chatIcon.classList.add("hidden");
        inputField.focus();

        // Kiểm tra lịch sử
        const hasHistory = loadHistory();
        
        // Nếu không có lịch sử, hiện chào mừng
        if (!hasHistory && messagesArea.querySelectorAll('.message').length === 0) {
            initWelcome();
        } else {
            // Nếu có lịch sử, hiện lại gợi ý ở cuối để tiện dùng tiếp
            setTimeout(addSuggestionButtons, 200);
        }
    });

    closeBtn.addEventListener("click", () => {
        chatWindow.classList.add("hidden");
        chatIcon.classList.remove("hidden");
    });

    // Hàm render và lưu tin nhắn
    function addMessageToUI(sender, text, save = true) {
        if (sender === 'user') removeSuggestionButtons();

        const msgDiv = document.createElement("div");
        msgDiv.classList.add("message", sender);
        
        const uName = getUserName();
        const avatarUrl = getAvatarUrl(sender, uName);
        
        msgDiv.innerHTML = `
            <img src="${avatarUrl}" class="chat-avatar" alt="${sender}">
            <div class="bubble">${text}</div>
        `;
        
        messagesArea.appendChild(msgDiv);
        messagesArea.scrollTop = messagesArea.scrollHeight;
        
        if (save) {
            saveToHistory(sender, text);
        }
    }

    async function handleChat(manualText = null) {
        const text = manualText || inputField.value.trim();
        if (!text) return;

        addMessageToUI("user", text, true); 
        inputField.value = "";
        inputField.disabled = true;

        const loadingDiv = document.createElement("div");
        loadingDiv.className = "message bot loading";
        loadingDiv.innerHTML = `<img src="${getAvatarUrl('bot')}" class="chat-avatar"><div class="bubble"><i class="fas fa-ellipsis-h"></i></div>`;
        messagesArea.appendChild(loadingDiv);
        messagesArea.scrollTop = messagesArea.scrollHeight;

        try {
            const context = getChatbotContext();
            const username = getUserName();

            const response = await fetch(`${API_BASE_URL}/api/ai/ask`, { 
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    question: text,
                    gameId: context.gameId,
                    username: username
                })
            });

            const data = await response.json();
            messagesArea.removeChild(loadingDiv);
            
            if (!response.ok) throw new Error(data.error || "Lỗi server");

            const aiReply = data.answer || "Xin lỗi, tôi không hiểu câu hỏi.";
            addMessageToUI("bot", aiReply, true); 

        } catch (error) {
            console.error("Chat error:", error);
            if(document.body.contains(loadingDiv)) messagesArea.removeChild(loadingDiv);
            addMessageToUI("bot", "Không thể kết nối tới máy chủ AI.", false); 
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