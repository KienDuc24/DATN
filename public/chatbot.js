// public/chatbot.js (ĐÃ ĐỒNG BỘ: Ngôn ngữ & Avatar DiceBear)

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

    // 3. Xử lý Đa ngôn ngữ
    let LANGS = {};
    const currentLang = localStorage.getItem('lang') || 'vi';

    async function loadChatLanguage() {
        try {
            const res = await fetch('/lang.json');
            LANGS = await res.json();
            applyLanguage();
        } catch (e) {
            console.error("Chatbot: Không tải được ngôn ngữ", e);
        }
    }

    function t(key, defaultText) {
        return LANGS[currentLang]?.[key] || defaultText || key;
    }

    function applyLanguage() {
        titleText.innerText = t('chat_title', 'Trợ lý AI');
        inputField.placeholder = t('chat_placeholder', 'Hỏi gì đó...');
        // Nếu chưa có tin nhắn nào, hiện tin chào mừng
        if (messagesArea.children.length === 0) {
            addMessage('bot', t('chat_welcome', 'Xin chào! Tôi là AI. Tôi có thể giúp gì cho bạn hôm nay?'));
        }
    }

    loadChatLanguage(); // Tải ngôn ngữ ngay

    // 4. Xử lý Avatar
    function getAvatarUrl(type, username) {
        if (type === 'bot') {
            // Avatar Bot đồng bộ phong cách
            return `https://api.dicebear.com/7.x/bottts/svg?seed=Assistant`; 
        }
        // Avatar User DiceBear (giống các phần khác)
        const safeName = username || 'guest';
        return `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(safeName)}`;
    }

    function getUserName() {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            return user.username || 'guest';
        } catch { return 'guest'; }
    }

    // 5. Logic Chat
    chatIcon.addEventListener("click", () => {
        chatWindow.classList.remove("hidden");
        chatIcon.classList.add("hidden");
        inputField.focus();
    });

    closeBtn.addEventListener("click", () => {
        chatWindow.classList.add("hidden");
        chatIcon.classList.remove("hidden");
    });

    function addMessage(sender, text) {
        const msgDiv = document.createElement("div");
        msgDiv.classList.add("message", sender);
        
        const avatarUrl = getAvatarUrl(sender, getUserName());
        
        // Cấu trúc tin nhắn: Avatar + Nội dung
        msgDiv.innerHTML = `
            <img src="${avatarUrl}" class="chat-avatar" alt="${sender}">
            <div class="bubble">${text}</div>
        `;
        
        messagesArea.appendChild(msgDiv);
        messagesArea.scrollTop = messagesArea.scrollHeight;
    }

    async function handleChat() {
        const text = inputField.value.trim();
        if (!text) return;

        // Hiện tin nhắn người dùng
        addMessage("user", text);
        inputField.value = "";
        inputField.disabled = true;

        // Hiện trạng thái đang gõ...
        const loadingDiv = document.createElement("div");
        loadingDiv.className = "message bot loading";
        loadingDiv.innerHTML = `<img src="${getAvatarUrl('bot')}" class="chat-avatar"><div class="bubble">...</div>`;
        messagesArea.appendChild(loadingDiv);
        messagesArea.scrollTop = messagesArea.scrollHeight;

        try {
            // Gọi API Chatbot (Backend của bạn)
            const response = await fetch("/api/chatbot", { 
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text })
            });

            const data = await response.json();
            
            // Xóa loading
            messagesArea.removeChild(loadingDiv);
            
            // Hiện tin nhắn Bot
            addMessage("bot", data.reply || "Xin lỗi, tôi đang gặp sự cố kết nối.");

        } catch (error) {
            console.error("Chat error:", error);
            messagesArea.removeChild(loadingDiv);
            addMessage("bot", "Không thể kết nối tới máy chủ.");
        } finally {
            inputField.disabled = false;
            inputField.focus();
        }
    }

    sendBtn.addEventListener("click", handleChat);
    inputField.addEventListener("keypress", (e) => {
        if (e.key === "Enter") handleChat();
    });
});