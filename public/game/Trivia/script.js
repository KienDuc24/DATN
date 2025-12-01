(() => {
    const API_BASE_URL = window.API_BASE_URL || 'https://datn-socket.up.railway.app';
    const socket = io(API_BASE_URL, { transports: ['websocket'], secure: true });

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

    function parseEmotion(message) {
        const match = message.match(/^\[(.*?)\](.*)/s);
        if (match) {
            return { key: mapTagToKey(match[1]), text: match[2].trim() };
        }
        return { key: 'default', text: message };
    }

    const urlParams = new URLSearchParams(window.location.search);
    const roomCode = urlParams.get('code');
    const playerName = urlParams.get('user');
    
    let isHost = false; 

    if (!roomCode || !playerName) { alert('Lỗi: Thiếu thông tin!'); window.location.href = '/'; }
    document.getElementById('roomCode').innerText = roomCode;

    const screens = {
        lobby: document.getElementById('lobbyScreen'),
        question: document.getElementById('questionScreen'),
        result: document.getElementById('resultScreen'),
        end: document.getElementById('endScreen')
    };
    const playerListEl = document.getElementById('playerList'); 
    const lobbyListEl = document.getElementById('lobbyPlayerList'); 
    const chatHistory = document.getElementById('chatHistory');
    
    let myAnswer = null;

    socket.on('connect', () => {
        socket.emit('trivia-join', { roomCode, player: { name: playerName } });
    });

    socket.on('trivia-room-update', ({ host, scores }) => {
        isHost = (host === playerName);
        updateHostButtons();

        const count = Object.keys(scores).length;
        document.getElementById('playerCount').innerText = count;
        
        renderLeaderboard(scores, host); 
        renderLobbyList(scores);  
    });

    socket.on('trivia-chat-receive', ({ sender, message, isCatmi }) => {
        let avatarUrl = '';
        let displayText = message;
        let emotionKey = 'default';

        if (isCatmi) {
            const parsed = parseEmotion(message);
            displayText = parsed.text;
            emotionKey = parsed.key;
            avatarUrl = CATMI_EXPRESSIONS[emotionKey];
        } else {
            avatarUrl = `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(sender)}`;
        }

        const isMe = sender === playerName;
        const type = isCatmi ? 'catmi' : (isMe ? 'user' : 'other');
        const displayName = isMe ? 'Bạn' : sender;

        appendChat(displayName, displayText, type, avatarUrl);
    });

    socket.on('catmi-says', ({ message }) => {
        const parsed = parseEmotion(message);
        const avatarUrl = CATMI_EXPRESSIONS[parsed.key];
        appendChat('Catmi 📢', parsed.text, 'catmi', avatarUrl);
    });

    socket.on('trivia-question', (data) => {
        showScreen('question');
        renderQuestion(data);
    });

    socket.on('trivia-timer', ({ time }) => {
        document.getElementById('timerText').innerText = time;
        const pct = (time / 15) * 100;
        const bar = document.getElementById('timerBar');
        bar.style.width = `${pct}%`;
        bar.style.backgroundColor = time <= 5 ? '#ff4757' : '#fddb3a';
    });

    socket.on('trivia-result', (data) => {
        showScreen('result');
        const isCorrect = myAnswer === data.correctAnswer;
        const st = document.getElementById('resultStatus');
        st.innerText = isCorrect ? "Chính xác! 🎉" : "Sai rồi! 😢";
        st.style.color = isCorrect ? "#2ecc71" : "#ff4757"; 
        
        document.getElementById('correctText').innerText = data.correctAnswer; 
        document.getElementById('explText').innerText = data.explanation;
    });

    socket.on('trivia-game-over', ({ winner, scores }) => {
        showScreen('end');
        document.getElementById('winnerName').innerText = winner || 'Không có';
        
        const sorted = Object.entries(scores).sort((a,b) => b[1]-a[1]);
        document.getElementById('finalScoreList').innerHTML = sorted.map(([n, s], i) => 
            `<div style="display:flex;justify-content:space-between;padding:8px;border-bottom:1px solid #eee">
                <span>#${i+1} <b>${n}</b></span> 
                <span style="color:var(--accent-green);font-weight:bold">${s} điểm</span>
            </div>`
        ).join('');

        updateHostButtons(); 
    });

    document.getElementById('startBtn').onclick = () => {
        socket.emit('trivia-start', { roomCode });
    };

    document.getElementById('restartBtn').onclick = () => {
        socket.emit('trivia-start', { roomCode });
    };

    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendChatBtn');

    function sendChat() {
        const txt = chatInput.value.trim();
        if(!txt) return;
        socket.emit('trivia-chat-send', { roomCode, message: txt });
        chatInput.value = '';
    }
    
    sendBtn.onclick = sendChat;
    chatInput.onkeypress = (e) => { if(e.key === 'Enter') sendChat(); };

    function updateHostButtons() {
        const startBtn = document.getElementById('startBtn');
        const restartBtn = document.getElementById('restartBtn');
        const waitText = document.getElementById('waitingRestartText');
        const waitLobby = document.getElementById('waitText'); 

        if (isHost) {
            startBtn.classList.remove('hidden');
            if(waitLobby) waitLobby.classList.add('hidden');
            if(restartBtn) restartBtn.classList.remove('hidden');
            if(waitText) waitText.classList.add('hidden');
        } else {
            startBtn.classList.add('hidden');
            if(waitLobby) waitLobby.classList.remove('hidden');
            if(restartBtn) restartBtn.classList.add('hidden');
            if(waitText) waitText.classList.remove('hidden');
        }
    }

    function showScreen(name) {
        Object.values(screens).forEach(s => s.classList.add('hidden'));
        screens[name].classList.remove('hidden');
        screens[name].classList.add('active');
    }

    function renderLeaderboard(scores, hostName) {
        const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        
        playerListEl.innerHTML = sorted.map(([name, score], idx) => {
            const isMe = name === playerName ? 'me' : '';
            const rankClass = idx === 0 ? 'top1' : (idx === 1 ? 'top2' : (idx === 2 ? 'top3' : ''));
            const avatarUrl = `https://api.dicebear.com/7.x/micah/svg?seed=${name}`;
            const hostIcon = name === hostName ? '👑' : '';
            
            return `
            <div class="player-row ${isMe}">
                <div class="rank ${rankClass}">#${idx + 1}</div>
                <img src="${avatarUrl}" class="p-avatar">
                <div class="p-info">
                    <div class="p-name">${name} ${hostIcon}</div>
                    <div class="p-score">${score} điểm</div>
                </div>
            </div>`;
        }).join('');
    }

    function renderLobbyList(scores) {
        lobbyListEl.innerHTML = Object.keys(scores).map(name => 
            `<div class="p-tag">
                <img src="https://api.dicebear.com/7.x/micah/svg?seed=${name}" style="width:20px;border-radius:50%"> 
                ${name}
            </div>`
        ).join('');
    }

    function renderQuestion(data) {
        document.getElementById('qIndex').innerText = data.index;
        document.getElementById('qTotal').innerText = data.total;
        document.getElementById('qContent').innerText = data.question;
        
        const grid = document.getElementById('optionsGrid');
        const btns = grid.querySelectorAll('.btn-ans');
        
        myAnswer = null;
        btns.forEach(btn => {
            const val = btn.dataset.val;
            btn.innerText = `${val}. ${data.options[val] || ""}`;
            btn.disabled = false;
            btn.classList.remove('selected');
            btn.onclick = () => {
                myAnswer = val;
                socket.emit('trivia-answer', { roomCode, answer: val });
                btns.forEach(b => b.disabled = true);
                btn.classList.add('selected');
            };
        });
    }

    function appendChat(displayName, msg, type, avatarUrl) {
        const div = document.createElement('div');
        div.className = `chat-row ${type}`; 
        
        if (!avatarUrl) {
             if (type === 'catmi') avatarUrl = '/assets/welcome.gif';
             else avatarUrl = `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(displayName)}`;
        }

        div.innerHTML = `
            <img class="chat-avatar" src="${avatarUrl}" alt="${displayName}">
            <div class="chat-bubble">
                <div class="chat-name">${displayName}</div>
                <div class="chat-text">${msg}</div>
            </div>
        `;
        
        chatHistory.appendChild(div);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }
})();