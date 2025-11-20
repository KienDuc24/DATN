// public/chatbot.js (FINAL: Full Sync History + Catmi Persona + Image Integration)

document.addEventListener("DOMContentLoaded", () => {
    // --- 1. KHAI BÁO CÁC ĐƯỜNG DẪN BIỂU CẢM CỦA CATMI ---
    // Đã sửa đường dẫn để khớp với cấu trúc thư mục của bạn: public/assets/avatar/
    // Các key này sẽ được ánh xạ trực tiếp với tên file ảnh (ví dụ: 'pout' -> 'pout.png')
    const CATMI_EXPRESSIONS = {
        default: "/assets/avatar.mp4",
        amazed: "/assets/amazed.png",     // [Ngạc nhiên / Bất ngờ]
        angry: "/assets/angry.png",       // [Tức giận / Cáu kỉnh dữ dội]
        annoyed: "/assets/annoyed.png",     // [Bực mình / Gặp lỗi]
        bye: "/assets/bye.png",           // [Tạm biệt / Ngủ]
        confused: "/assets/confused.png",   // [Hoài nghi / Không chắc chắn]
        cute: "/assets/cute.png",         // [Chào mừng / Vui vẻ tổng quát] - có thể dùng cho default
        focus: "/assets/focus.png",       // [Tập trung cao độ]
        guild: "/assets/guild.png",       // [Chỉ dẫn / Hướng dẫn]
        happy: "/assets/happy.png",       // [Tìm thấy kết quả / Thành công]
        mad: "/assets/mad.png",           // (Khác của tức giận)
        question: "/assets/question.png", // Dùng lại confused nếu không có ảnh riêng cho "question"
        sad: "/assets/sad.png",           // [Buồn bã / Đồng cảm]
        sorry: "/assets/sorry.png",       // (Có thể dùng cho lỗi hoặc đồng cảm)
        searching: "/assets/searching.png", // [Đang tìm kiếm] (Nếu là GIF)
        success: "/assets/success.png",     // [Vỗ tay / Khuyến khích] - hoặc happy
        teasing: "/assets/teasing.png",     // [Đùa vui / Trêu chọc nhẹ]
        thinking: "/assets/thinking.png",   // [Đang suy nghĩ / Xử lý dữ liệu] (Nếu là GIF)
        tired: "/assets/tired.png",         // [Mệt mỏi / Pin yếu]
        welcome: "/assets/welcome.png",     // (Dùng cho chào mừng)
        yessir: "/assets/yessir.png"            // (Dùng cho đã hiểu rõ)
        // Lưu ý: Nếu ảnh là GIF, hãy thay .png bằng .gif
    };
    // ----------------------------------------------------------------------------------

    // 2. Render HTML
    const chatbotContainer = document.createElement("div");
    chatbotContainer.id = "chatbot-container";
    chatbotContainer.innerHTML = `
        <div id="chatbot-icon">
            <img src="/assets/avatar.mp4" alt="Catmi">
        </div>
        <div id="chatbot-window" class="hidden">
            <div id="chatbot-header">
                <div class="header-info">
                    <img src="/assets/avatar.mp4" alt="Bot Avatar">
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
    // --- CĂN CHỈNH VỊ TRÍ BOT SANG GÓC DƯỚI BÊN TRÁI ---
    chatbotContainer.style.position = 'fixed';
    chatbotContainer.style.bottom = '20px';
    chatbotContainer.style.left = '20px'; 
    chatbotContainer.style.right = 'auto'; 
    // ----------------------------------------------------
    document.body.appendChild(chatbotContainer);

    // 3. DOM Elements & Constants
    const chatIcon = document.getElementById("chatbot-icon");
    const chatWindow = document.getElementById("chatbot-window");
    const closeBtn = document.getElementById("chatbot-close");
    const resetBtn = document.getElementById("chatbot-reset");
    const sendBtn = document.getElementById("chatbot-send");
    const inputField = document.getElementById("chatbot-input");
    const messagesArea = document.getElementById("chatbot-messages");
    const titleText = document.getElementById("chat-title-text");
    const API_BASE_URL = window.BASE_API || 'https://datn-socket.up.railway.app';

    // 4. Context & Auth Helpers
    function getUserInfo() { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } }
    function isRealUser() { const user = getUserInfo(); return user.username && !user.isGuest && !user.username.startsWith('guest_'); }
    function getUserDisplayName() { const user = getUserInfo(); return user.displayName || user.username || 'Bạn'; }
    function getUserName() { return getUserInfo().username || 'guest'; }
    function getChatbotContext() { 
        const pathname = window.location.pathname;
        if (pathname.endsWith('/room.html') || pathname.includes('/game/')) {
            const gameId = new URLSearchParams(window.location.search).get('gameId');
            return { page: 'room', gameId: gameId || 'all' };
        }
        return { page: 'index', gameId: 'all' };
    }

    // 5. Multi-language
    let LANGS = {};
    async function loadChatLanguage() {
        try {
            const res = await fetch('/lang.json');
            LANGS = await res.json();
        } catch (e) {
            console.error("Failed to load lang.json:", e);
        }
    }
    function getCurrentLang() { return localStorage.getItem('lang') || 'vi'; }
    function t(key, defaultText) {
        const lang = getCurrentLang();
        return LANGS[lang]?.[key] || defaultText || key;
    }
    function applyLanguage() {
        titleText.innerText = t('chat_title', 'Catmi - Trợ lý ảo');
        inputField.placeholder = t('chat_placeholder', 'Hỏi Catmi...');
        resetBtn.title = getCurrentLang() === 'vi' ? 'Xóa lịch sử' : 'Clear history';
    }
    loadChatLanguage(); 

    // 6. MAPPING CẢM XÚC (Đã sửa để khớp với tên file của bạn)
    function mapTagToKey(tag) {
        const tagLower = tag.toLowerCase().replace(/[\s\/\\]/g, ''); 
        
        // Cố gắng ánh xạ trực tiếp với tên file
        if (CATMI_EXPRESSIONS[tagLower]) return tagLower;

        // Ánh xạ các tag AI dài hơn hoặc có nhiều từ
       if (tagLower.includes('welcome') || tagLower.includes('start')) return 'welcome';
        if (tagLower.includes('thinking') || tagLower.includes('processing')) return 'thinking';
        if (tagLower.includes('searching')) return 'searching';
        if (tagLower.includes('annoyed') || tagLower.includes('error')) return 'annoyed'; 
        if (tagLower.includes('tired') || tagLower.includes('lowbattery')) return 'tired';
        if (tagLower.includes('success') || tagLower.includes('found')) return 'happy'; // Hoặc 'success' nếu bạn muốn phân biệt
        if (tagLower.includes('listening')) return 'yessir'; // Dùng 'yessir' cho lắng nghe/đã hiểu
        if (tagLower.includes('playful') || tagLower.includes('teasing')) return 'teasing';
        if (tagLower.includes('surprised')) return 'amazed'; // Dùng 'amazed' cho ngạc nhiên
        if (tagLower.includes('goodbye') || tagLower.includes('sleeping')) return 'bye'; // Hoặc 'yawn'
        if (tagLower.includes('skeptical') || tagLower.includes('unsure')) return 'confused';
        if (tagLower.includes('applauding') || tagLower.includes('encouraging')) return 'success'; // Hoặc 'cute'
        if (tagLower.includes('guiding') || tagLower.includes('instructing')) return 'guild';
        if (tagLower.includes('happy') || tagLower.includes('content')) return 'happy';
        if (tagLower.includes('sad') || tagLower.includes('empathetic')) return 'sad';
        if (tagLower.includes('deepfocus')) return 'focus';
        if (tagLower.includes('angry') || tagLower.includes('furious')) return 'angry';
        // Các tag bạn thêm vào
        if (tagLower.includes('praise')) return 'cute'; // Giữ nguyên khen ngợi nếu bạn muốn Catmi có biểu cảm này
        if (tagLower.includes('question') || tagLower.includes('doubt')) return 'question'; // Dùng 'question'
        
        return 'default'; // Trạng thái mặc định nếu không khớp tag nào
    }

    // 7. Avatar (Cập nhật để sử dụng CATMI_EXPRESSIONS)
    function getAvatarUrl(type, username, expressionKey = 'default') {
        if (type === 'bot') {
            return CATMI_EXPRESSIONS[expressionKey] || CATMI_EXPRESSIONS.default; 
        }
        const safeName = username || 'guest';
        return `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(safeName)}`;
    }

    // 8. History & Main Logic
    
    function loadHistory() {
        try {
            const history = JSON.parse(sessionStorage.getItem('chat_history') || '[]');
            if (history.length > 0) {
                history.forEach(msg => { 
                    addMessageToUI(msg.sender, msg.text, false, msg.emotion || 'default'); 
                });
                setTimeout(() => messagesArea.scrollTop = messagesArea.scrollHeight, 100);
                return true; 
            }
        } catch (e) { console.error('History load error', e); }
        return false; 
    }

    function saveToHistory(sender, text, emotion) {
        try {
            const history = JSON.parse(sessionStorage.getItem('chat_history') || '[]');
            history.push({ sender, text, emotion }); 
            if (history.length > 50) history.shift(); 
            sessionStorage.setItem('chat_history', JSON.stringify(history));
        } catch (e) { console.error('History save error', e); }
    }

    function clearHistory() {
        sessionStorage.removeItem('chat_history');
        messagesArea.innerHTML = '';
        initWelcome();
    }
    
    resetBtn.addEventListener('click', () => {
        const lang = getCurrentLang();
        const msg = lang === 'vi' ? 'Xóa toàn bộ cuộc trò chuyện?' : 'Clear all chat history?';
        if(confirm(msg)) clearHistory();
    });

    // --- LOGIC GỢI Ý (SUGGESTIONS) ---
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
            const btn1 = lang === 'vi' ? 'Mô tả game này' : 'Describe this game';
            const btn2 = lang === 'vi' ? 'Luật chơi thế nào?' : 'How to play?';
            buttonsHTML += `<button class="suggestion-btn" data-question="${btn1}">${btn1} <i class="fas fa-info-circle"></i></button>`;
            buttonsHTML += `<button class="suggestion-btn" data-question="${btn2}">${btn2} <i class="fas fa-book"></i></button>`;
        } else {
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
                const q = btn.getAttribute('data-question');
                const a = btn.getAttribute('data-action');
                if (q) handleChat(q);
                else if (a === 'login') {
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
        const el = document.getElementById('chat-suggestions');
        if (el) el.remove();
    }

    function initWelcome() {
        const displayName = getUserDisplayName();
        const lang = getCurrentLang();
        const welcomeTextTemplate = t('chat_welcome', 'Méo... Chào %USER_NAME%!...'); 
        const welcomeText = welcomeTextTemplate.replace('%USER_NAME%', displayName);
        
        // Sử dụng biểu cảm 'welcome' hoặc 'cute' nếu có
        addMessageToUI('bot', welcomeText, true, CATMI_EXPRESSIONS.welcome ? 'welcome' : 'cute'); // Ưu tiên 'welcome', nếu không có thì 'cute'
        setTimeout(addSuggestionButtons, 500);
    }

    // 9. Logic Chat Chính
    chatIcon.addEventListener("click", () => {
        applyLanguage(); 
        chatWindow.classList.remove("hidden");
        chatIcon.classList.add("hidden");
        inputField.focus();

        const hasHistory = loadHistory();
        
        if (!hasHistory && messagesArea.querySelectorAll('.message').length === 0) {
            initWelcome();
        } else {
            setTimeout(addSuggestionButtons, 200);
        }
    });

    closeBtn.addEventListener("click", () => {
        chatWindow.classList.add("hidden");
        chatIcon.classList.remove("hidden");
    });

    function addMessageToUI(sender, text, save = true, expressionKey = 'default') {
        if (sender === 'user') removeSuggestionButtons();

        const msgDiv = document.createElement("div");
        msgDiv.classList.add("message", sender);
        
        const uName = getUserName();
        const avatarUrl = getAvatarUrl(sender, uName, expressionKey); 
        
        msgDiv.innerHTML = `<img src="${avatarUrl}" class="chat-avatar" alt="${sender}"><div class="bubble">${text}</div>`;
        messagesArea.appendChild(msgDiv);
        messagesArea.scrollTop = messagesArea.scrollHeight;
        
        if (save) {
            saveToHistory(sender, text, expressionKey); 
        }
    }

    async function handleChat(manualText = null) {
        const text = manualText || inputField.value.trim();
        if (!text) return;

        addMessageToUI("user", text, true, 'default'); 
        inputField.value = "";
        inputField.disabled = true;

        const loadingDiv = document.createElement("div");
        loadingDiv.className = "message bot loading";
        
        // SỬ DỤNG BIỂU CẢM 'thinking' cho loading
        const loadingMsg = t('chat_loading_thinking', 'Catmi đang băn khoăn...');
        loadingDiv.innerHTML = `<img src="${getAvatarUrl('bot', '', 'thinking')}" class="chat-avatar"><div class="bubble">${loadingMsg} <i class="fas fa-ellipsis-h"></i></div>`;
        
        messagesArea.appendChild(loadingDiv);
        messagesArea.scrollTop = messagesArea.scrollHeight;

        try {
            const context = getChatbotContext();
            const username = getUserName();
            const lang = getCurrentLang();

            const response = await fetch(`${API_BASE_URL}/api/ai/ask`, { 
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    question: text,
                    gameId: context.gameId,
                    username: username,
                    language: lang
                })
            });

            const data = await response.json();
            messagesArea.removeChild(loadingDiv);
            
            if (!response.ok) throw new Error(data.error || "Lỗi server");

            let aiReply = data.answer;
            let expressionKeyForReply = 'default';

            // TRÍCH XUẤT BIỂU CẢM TỪ CÂU TRẢ LỜI CỦA AI
            const expressionMatch = aiReply.match(/\[(.*?)\]/); 
            if (expressionMatch) {
                const tag = expressionMatch[1]; 
                expressionKeyForReply = mapTagToKey(tag); 
                aiReply = aiReply.replace(expressionMatch[0], '').trim(); 
            }
            
            const fallbackMsg = lang === 'vi' ? "Xin lỗi, tôi không hiểu câu hỏi." : "Sorry, I didn't understand the question.";
            
            addMessageToUI("bot", aiReply || fallbackMsg, true, expressionKeyForReply); 

        } catch (error) {
            console.error("Chat error:", error);
            if(document.body.contains(loadingDiv)) messagesArea.removeChild(loadingDiv);
            const errMsg = getCurrentLang() === 'vi' ? "Lỗi kết nối." : "Connection error.";
            // Sử dụng biểu cảm 'annoyed' cho trường hợp lỗi kết nối hoặc 'tired' cho lỗi pin yếu
            addMessageToUI("bot", errMsg, false, 'annoyed'); 
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