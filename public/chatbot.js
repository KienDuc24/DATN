document.addEventListener("DOMContentLoaded", () => {
    const CAMI_AVATAR_STATIC = "/assets/welcome.gif"; 
    const CATMI_EXPRESSIONS = {
        default: "/assets/welcome.gif",   
        amazed: "/assets/amazed.gif",    
        angry: "/assets/angry.gif",      
        annoyed: "/assets/annoyed.gif",    
        bye: "/assets/bye.gif",          
        confused: "/assets/confused.gif",  
        cute: "/assets/cute.gif",        
        focus: "/assets/focus.gif",      
        guild: "/assets/guild.gif",      
        happy: "/assets/happy.gif",      
        mad: "/assets/mad.gif",          
        question: "/assets/question.gif",
        sad: "/assets/sad.gif",          
        sassy: "/assets/sassy.gif",      
        searching: "/assets/searching.gif",
        success: "/assets/success.gif",   
        teasing: "/assets/teasing.gif",   
        thinking: "/assets/thinking.gif",  
        tired: "/assets/tired.gif",       
        welcome: "/assets/welcome.gif",   
        yessir: "/assets/yessir.gif"      
    };

    const chatbotContainer = document.createElement("div");
    chatbotContainer.id = "chatbot-container";
    
    const botAvatarUrl = CAMI_AVATAR_STATIC; 
    
    chatbotContainer.innerHTML = `
        <div id="chatbot-icon">
            <img src="${botAvatarUrl}" alt="Catmi">
        </div>
        <div id="chatbot-window" class="hidden">
            <div id="chatbot-header">
                <div class="header-info">
                    <img src="${botAvatarUrl}" alt="Bot Avatar" class="chat-avatar header-avatar">
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
                    <i class="fa fa-paper-plane" aria-hidden="true"></i>
                </button>
            </div>
        </div>
    `;
    
    chatbotContainer.style.position = 'fixed';
    chatbotContainer.style.bottom = '20px';
    chatbotContainer.style.right = '20px'; 
    chatbotContainer.style.left = 'auto'; 
    
    document.body.appendChild(chatbotContainer);

    const chatWindow = document.getElementById("chatbot-window");
    chatWindow.style.transformOrigin = 'bottom right';
    chatWindow.style.height = '66vh'; 
    chatWindow.style.maxWidth = '380px';

    const chatIcon = document.getElementById("chatbot-icon");
    const closeBtn = document.getElementById("chatbot-close");
    const resetBtn = document.getElementById("chatbot-reset");
    const sendBtn = document.getElementById("chatbot-send");
    const inputField = document.getElementById("chatbot-input");
    const messagesArea = document.getElementById("chatbot-messages");
    const titleText = document.getElementById("chat-title-text");
    const headerAvatar = document.querySelector('#chatbot-header .header-info img');
    const API_BASE_URL = window.API_BASE_URL || 'https://datn-socket.up.railway.app';

    let isWelcomeSent = false;

    function getUserInfo() { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } }
    function isRealUser() { const u = getUserInfo(); return u.username && !u.isGuest && !u.username.startsWith('guest_'); }
    function getUserDisplayName() { const u = getUserInfo(); return u.displayName || u.username || 'Bạn'; }
    function getUserName() { return getUserInfo().username || 'guest'; }
    function getChatbotContext() { const pathname = window.location.pathname; if (pathname.endsWith('/room.html') || pathname.includes('/game/')) { const gameId = new URLSearchParams(window.location.search).get('gameId'); return { page: 'room', gameId: gameId || 'all' }; } return { page: 'index', gameId: 'all' }; }

    let LANGS = {};
    async function loadChatLanguage() { try { const res = await fetch('/lang.json'); LANGS = await res.json(); } catch (e) {console.error("Failed to load lang.json:", e);} }
    function getCurrentLang() { return localStorage.getItem('lang') || 'vi'; }
    function t(key, defaultText) { const lang = getCurrentLang(); return LANGS[lang]?.[key] || defaultText || key; }
    function applyLanguage() {
        titleText.innerText = t('chat_title', 'Catmi - Nàng Trợ Lý Chảnh Chọe');
        inputField.placeholder = t('chat_placeholder', 'Hỏi Catmi...');
        resetBtn.title = getCurrentLang() === 'vi' ? 'Xóa lịch sử' : 'Clear history';
        headerAvatar.src = CAMI_AVATAR_STATIC; 
    }
    loadChatLanguage().then(applyLanguage); 

    function mapTagToKey(tag) {
        const tagLower = tag.toLowerCase().replace(/[\s\/\\]/g, ''); 
        
        if (tagLower.includes('welcome') || tagLower.includes('start')) return 'welcome';
        if (tagLower.includes('thinking') || tagLower.includes('processing')) return 'thinking'; 
        if (tagLower.includes('sassy')) return 'sassy';
        if (tagLower.includes('annoyed') || tagLower.includes('error')) return 'annoyed'; 
        if (tagLower.includes('tired') || tagLower.includes('lowbattery')) return 'tired';
        if (tagLower.includes('success') || tagLower.includes('found')) return 'happy'; 
        if (tagLower.includes('listening')) return 'yessir'; 
        if (tagLower.includes('playful') || tagLower.includes('teasing')) return 'teasing';
        if (tagLower.includes('surprised')) return 'amazed'; 
        if (tagLower.includes('goodbye') || tagLower.includes('sleeping')) return 'bye'; 
        if (tagLower.includes('skeptical') || tagLower.includes('unsure')) return 'confused';
        if (tagLower.includes('applauding') || tagLower.includes('encouraging')) return 'success'; 
        if (tagLower.includes('guiding') || tagLower.includes('instructing')) return 'guild';
        if (tagLower.includes('happy') || tagLower.includes('content')) return 'happy';
        if (tagLower.includes('sad') || tagLower.includes('empathetic')) return 'sad';
        if (tagLower.includes('deepfocus')) return 'focus';
        if (tagLower.includes('mad')) return 'mad';
        if (tagLower.includes('angry') || tagLower.includes('furious')) return 'angry';
        if (tagLower.includes('praise')) return 'cute'; 
        if (tagLower.includes('question') || tagLower.includes('doubt')) return 'question';
        
        return 'default';
    }

    function getAvatarUrl(type, username, expressionKey = 'default') {
        if (type === 'bot') {
            return CATMI_EXPRESSIONS[expressionKey] || CATMI_EXPRESSIONS.default; 
        }
        const safeName = username || 'guest';
        return `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(safeName)}`;
    }

    function loadHistory() {
        try {
            const history = JSON.parse(sessionStorage.getItem('chat_history') || '[]');
            if (history.length > 0) {
                history.forEach(msg => { addMessageToUI(msg.sender, msg.text, false, msg.emotion || 'default'); });
                setTimeout(() => messagesArea.scrollTop = messagesArea.scrollHeight, 100);
                isWelcomeSent = true; 
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
        isWelcomeSent = false; 
        initWelcome();
    }
    
    resetBtn.addEventListener('click', () => {
        const lang = getCurrentLang();
        const msg = lang === 'vi' ? 'Xóa toàn bộ cuộc trò chuyện?' : 'Clear all chat history?';
        if(confirm(msg)) clearHistory();
    });

    function initWelcome() {
        if (isWelcomeSent) return; 

        const displayName = getUserDisplayName();
        const lang = getCurrentLang();
        
        const welcomeTextTemplate = t('chat_welcome', 'Méo... Chào %USER_NAME%!...'); 
        const welcomeText = welcomeTextTemplate.replace('%USER_NAME%', displayName);
        const initialExpression = CATMI_EXPRESSIONS.welcome ? 'welcome' : (CATMI_EXPRESSIONS.cute ? 'cute' : 'default');
        addMessageToUI('bot', welcomeText, true, initialExpression);

        setTimeout(() => {
            const introText = t('chat_intro', 'Mình là Catmi, trợ lý ảo siêu cấp đáng yêu (và hơi chảnh) của bạn đây! Cần gì cứ hỏi nhé! 😽');
            addMessageToUI('bot', introText, true, 'cute');
            setTimeout(addSuggestionButtons, 500);
        }, 1000);
        
        isWelcomeSent = true;
    }

    chatIcon.addEventListener("click", () => {
        applyLanguage(); 
        chatWindow.classList.remove("hidden");
        chatIcon.classList.add("hidden");
        inputField.focus();

        const hasHistory = loadHistory();
        
        if (!hasHistory && !isWelcomeSent) {
            initWelcome();
        } else {
            setTimeout(addSuggestionButtons, 200);
        }
    });

    closeBtn.addEventListener("click", () => {
        chatWindow.classList.add("hidden");
        chatIcon.classList.remove("hidden");
    });

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

    function addMessageToUI(sender, text, save = true, expressionKey = 'default') {
        if (sender === 'user') removeSuggestionButtons();

        const msgDiv = document.createElement("div");
        msgDiv.classList.add("message", sender);
        
        const uName = getUserName();
        const avatarUrl = getAvatarUrl(sender, uName, expressionKey); 
        
        if (sender === 'bot') {
             msgDiv.innerHTML = `
                 <div class="bot-info-container">
                    <img src="${avatarUrl}" class="chat-avatar large-avatar" alt="Catmi">
                    <span class="bot-name">Catmi</span>
                 </div>
                 <div class="bubble bot-bubble">${text}</div>
            `;
        } else {
             msgDiv.innerHTML = `
                 <div class="bubble user-bubble">${text}</div>
                 <img src="${avatarUrl}" class="chat-avatar large-avatar user-avatar" alt="${sender}">
            `;
        }
        
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
        
        const thinkingExpression = CATMI_EXPRESSIONS.thinking ? 'thinking' : 'default';
        
        loadingDiv.innerHTML = `
             <div class="bot-info-container">
                <img src="${getAvatarUrl('bot', '', thinkingExpression)}" class="chat-avatar large-avatar" alt="Thinking">
                <span class="bot-name">Catmi</span>
             </div>
             <div class="bubble bot-bubble">...</div>
        `;
        
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

            const expressionMatch = aiReply.match(/\[(.*?)\]/); 
            if (expressionMatch) {
                const tag = expressionMatch[1]; 
                expressionKeyForReply = mapTagToKey(tag);
                aiReply = aiReply.replace(expressionMatch[0], '').trim(); 
            }
            
            const fallbackMsg = lang === 'vi' ? "Xin lỗi, Catmi không hiểu câu hỏi. Bạn có thể thử hỏi lại hoặc hỏi điều khác." : "Sorry, Catmi didn't understand the question. You can try asking again or something else.";
            
            addMessageToUI("bot", aiReply || fallbackMsg, true, expressionKeyForReply); 

        } catch (error) {
            console.error("Chat error:", error);
            if(document.body.contains(loadingDiv)) messagesArea.removeChild(loadingDiv);
            const errMsg = getCurrentLang() === 'vi' ? "Catmi đang rất mệt mỏi và cần nghỉ ngơi. Nói chuyện sau nhé 👋" : "Catmi is very tired and needs to rest. Talk to you later 👋";
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