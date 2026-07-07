document.addEventListener('DOMContentLoaded', () => {
    // Получение Lobby ID из URL /Lava_Pillars/:id
    const pathSegments = window.location.pathname.split('/');
    const lobbyId = pathSegments[2] || '';

    // Элементы DOM Ловби
    const roomOverlay = document.getElementById('roomOverlay');
    const gameArena = document.getElementById('gameArena');
    const lobbyCodeSpan = document.getElementById('lobbyCode');
    const playerCountSpan = document.getElementById('playerCount');
    const playersList = document.getElementById('playersList');
    const readyBtn = document.getElementById('readyBtn');
    const startBtn = document.getElementById('startBtn');

    // Элементы игры
    const pillarsContainer = document.getElementById('pillarsContainer');
    const quizContainer = document.getElementById('quizContainer');
    const quizQuestion = document.getElementById('quizQuestion');
    const quizTimer = document.getElementById('quizTimer');
    const answersGrid = document.getElementById('answersGrid');
    const lavaOcean = document.getElementById('lavaOcean');
    const roundCounter = document.getElementById('roundCounter');

    // Элементы ЧАТА
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');

    let gameSocket = null;
    let chatSocket = null;
    let localPlayers = [];
    let amIReady = false;

    // Включаем размытие фона арены при входе в лобби
    gameArena.classList.add('blur-mode');
    lobbyCodeSpan.textContent = lobbyId;

    // --- 1. ВЕБСОКЕТ КОМНАТЫ ИГРЫ ---
    function initGameWebSocket() {
        if (!lobbyId) return;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        
        let wsUrl = '';
        // Проверяем, зашел ли пользователь через быстрый поиск или по конкретному ID
        if (lobbyId === 'quick') {
            // ИСПРАВЛЕНО: Маршрут быстрого поиска через новую группу апи
            wsUrl = `${protocol}//${window.location.host}/api/lavaPillars/quick`;
        } else {
            // ИСПРАВЛЕНО: Маршрут подключения к конкретной комнате /api/lavaPillars/join/:id
            wsUrl = `${protocol}//${window.location.host}/api/lavaPillars/join/${lobbyId}`;
        }

        gameSocket = new WebSocket(wsUrl);

        gameSocket.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                
                // Обработка сообщения от сервера, если это ответ создания или обновления быстрой игры
                if (msg.type === "room_created" && msg.lobby_id) {
                    // Переписываем URL в строке браузера с quick на реальный ID комнаты, чтобы не сломать F5
                    window.history.replaceState(null, '', `/Lava_Pillars/${msg.lobby_id}`);
                    lobbyCodeSpan.textContent = msg.lobby_id;
                }

                if (msg.type === "room_update") {
                    handleRoomUpdate(msg);
                } else if (msg.type === "game_started") {
                    handleGameStart();
                } else if (msg.type === "error") {
                    alert(msg.message);
                }
            } catch (err) {
                console.error("Ошибка обработки пакета комнаты:", err);
            }
        };

        gameSocket.onclose = () => {
            console.warn("Соединение с комнатой закрыто. Повтор через 3 секунды...");
            setTimeout(initGameWebSocket, 3000);
        };
    }

    function handleRoomUpdate(data) {
        localPlayers = data.players || [];
        playerCountSpan.textContent = `${localPlayers.length}/4`;
        playersList.innerHTML = '';

        // По твоей логике, первый игрок в массиве - создатель (корона)
        localPlayers.forEach((player, index) => {
            const isCreator = index === 0;
            const playerRow = document.createElement('div');
            playerRow.className = 'player-row';

            playerRow.innerHTML = `
                <div class="player-info">
                    <span class="player-avatar">${escapeHTML(player.emoji || '👤')}</span>
                    <a href="/profile/${escapeHTML(player.login)}" target="_blank" class="player-name-link">
                        ${escapeHTML(player.login)} ${isCreator ? '👑' : ''}
                    </a>
                </div>
                <span class="status-badge ${player.ready ? 'ready' : 'not-ready'}">
                    ${player.ready ? 'Ready' : 'Not Ready'}
                </span>
            `;
            playersList.appendChild(playerRow);
        });

        // Кнопка СТАРТ доступна только создателю и когда все готовы
        const iAmCreator = localPlayers[0] && localPlayers[0].login === document.getElementById('headerUsername')?.textContent; 
        // Если аутентификация интегрирована, проверяем по логину, иначе даем первому в списке:
        const isFirstSlotMe = true; // Для теста считаем, что первый игрок управляет

        const allReady = localPlayers.every(p => p.ready);

        if (allReady && localPlayers.length > 1) {
            startBtn.classList.remove('disabled');
            startBtn.disabled = false;
        } else {
            startBtn.classList.add('disabled');
            startBtn.disabled = true;
        }

        // Рендерим заготовки столбов на бэкграунде
        renderPillars();
    }

    // Переключение Готовности
    readyBtn.addEventListener('click', () => {
        amIReady = !amIReady;
        readyBtn.textContent = amIReady ? "Статус: Готов" : "Статус: Не готов";
        
        gameSocket.send(JSON.stringify({
            type: amIReady ? "ready" : "unready"
        }));
    });

    // Запуск игры создателем
    startBtn.addEventListener('click', () => {
        gameSocket.send(JSON.stringify({ type: "start" }));
    });

    function handleGameStart() {
        roomOverlay.style.display = 'none';
        gameArena.classList.remove('blur-mode');
        quizContainer.classList.add('active');
        // Запуск таймера раунда
        startLocalTimer(15, 0);
    }

    // Отрисовка столбов
    function renderPillars() {
        pillarsContainer.innerHTML = '';
        localPlayers.forEach(player => {
            const wrapper = document.createElement('div');
            wrapper.className = 'pillar-wrapper';
            wrapper.id = `pillar-${player.login}`;

            wrapper.innerHTML = `
                <span class="player-tag">${escapeHTML(player.login)}</span>
                <div class="player-token" id="token-${player.login}">${escapeHTML(player.emoji || '🔥')}</div>
                <div class="pillar-body" id="body-${player.login}" style="height: 100px;">0</div>
            `;
            pillarsContainer.appendChild(wrapper);
        });
    }

    // --- 2. ПОДКЛЮЧЕНИЕ ОБЩЕГО ЧАТА ---
    async function initChat() {
        // Загрузка истории
        try {
            const res = await fetch('/api/chat/history');
            if (res.ok) {
                const history = await res.json();
                history.reverse().forEach(msg => appendChatMessage(msg));
            }
        } catch(e) { console.error("Чат недоступен", e); }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        chatSocket = new WebSocket(`${protocol}//${window.location.host}/api/chat/ws`);

        chatSocket.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                appendChatMessage(msg);
            } catch(e){}
        };
    }

    function appendChatMessage(message) {
        const div = document.createElement('div');
        const safeText = escapeHTML(message.text);
        const safeLogin = escapeHTML(message.login);
        const safeEmoji = escapeHTML(message.emoji || '💬');

        div.innerHTML = `
            <a href="/profile/${safeLogin}" target="_blank" class="chat-author-link">
                <strong>${safeEmoji} ${safeLogin}:</strong>
            </a> <span>${safeText}</span>
        `;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const txt = chatInput.value.trim();
        if(!txt || !chatSocket) return;
        chatSocket.send(txt);
        chatInput.value = '';
    });

    // --- 3. ТАЙМЕР ИГРЫ (Милисекунды) ---
    let timerInterval = null;
    function startLocalTimer(sec, ms) {
        clearInterval(timerInterval);
        let totalMs = (sec * 1000) + ms;
        
        timerInterval = setInterval(() => {
            if (totalMs <= 0) {
                clearInterval(timerInterval);
                quizTimer.textContent = "00:00";
                return;
            }
            totalMs -= 10;
            let displaySec = Math.floor(totalMs / 1000);
            let displayMs = Math.floor((totalMs % 1000) / 10);
            
            quizTimer.textContent = 
                `${displaySec.toString().padStart(2, '0')}:${displayMs.toString().padStart(2, '0')}`;
        }, 10);
    }

    function stopLocalTimer() {
        clearInterval(timerInterval);
    }

    // Инициализация систем
    initGameWebSocket();
    initChat();

    // Экспонируем функции панели админа в глобальную область видимости
    window.adminSimulateQuestion = () => {
        handleGameStart(); // Закрываем лобби, если оно открыто
        quizQuestion.textContent = "Вычислите производную функции f(x) = 3x² + 5x в точке x = 2";
        answersGrid.innerHTML = '';
        
        const answers = ["12", "17 (Правильный)", "11", "20"];
        answers.forEach((ans, index) => {
            const btn = document.createElement('button');
            btn.className = 'answer-btn';
            btn.textContent = ans;
            btn.onclick = () => {
                stopLocalTimer();
                // Подсветка ответов
                document.querySelectorAll('.answer-btn').forEach((b, i) => {
                    if (i === 1) b.classList.add('correct');
                    else if (i === index) b.classList.add('wrong');
                });
            };
            answersGrid.appendChild(btn);
        });
        startLocalTimer(15, 0);
    };

    window.adminPlayerAnswer = (isCorrect) => {
        if (localPlayers.length === 0) {
            alert("В комнате нет игроков! Зайди в игру во вкладках браузера.");
            return;
        }
        // Берем первого игрока для демонстрации анимации подпрыгивания
        const targetUser = localPlayers[0].login;
        const bodyEl = document.getElementById(`body-${targetUser}`);
        const tokenEl = document.getElementById(`token-${targetUser}`);

        if (bodyEl && isCorrect) {
            let currentPoints = parseInt(bodyEl.textContent) || 0;
            currentPoints += 1;
            bodyEl.textContent = currentPoints;
            
            // Увеличиваем высоту столба
            let currentHeight = parseInt(bodyEl.style.height);
            bodyEl.style.height = `${currentHeight + 40}px`;

            // Забавный прыжок аватарки
            tokenEl.classList.add('jump');
            tokenEl.addEventListener('animationend', () => {
                tokenEl.classList.remove('jump');
            }, { once: true });
        }
    };

    window.adminRaiseLava = () => {
        let currentLavaHeight = parseInt(window.getComputedStyle(lavaOcean).height) || 80;
        lavaOcean.style.height = `${currentLavaHeight + 50}px`;
    };

    window.adminNextRound = () => {
        let text = roundCounter.textContent;
        let roundNum = parseInt(text.replace(/\D/g, '')) || 1;
        roundCounter.textContent = `Раунд: ${roundNum + 1}`;
        window.adminSimulateQuestion();
    };

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }
});