document.addEventListener('DOMContentLoaded', () => {
    const pathSegments = window.location.pathname.split('/');
    const lobbyId = pathSegments[2] || '';
    const gameModeSelector = document.getElementById('gameModeSelector');
    // DOM Элементы
    const countdownOverlay = document.getElementById('countdownOverlay');
    const countdownNumber = document.getElementById('countdownNumber');
    const roomOverlay = document.getElementById('roomOverlay');
    const gameOverOverlay = document.getElementById('gameOverOverlay');
    const gameOverTitle = document.getElementById('gameOverTitle');
    const gameOverSub = document.getElementById('gameOverSub');
    const gameArena = document.getElementById('gameArena');
    const lobbyCodeSpan = document.getElementById('lobbyCode');
    const playerCountSpan = document.getElementById('playerCount');
    const playersList = document.getElementById('playersList');
    const readyBtn = document.getElementById('readyBtn');
    const startBtn = document.getElementById('startBtn');

    const pillarsContainer = document.getElementById('pillarsContainer');
    const quizContainer = document.getElementById('quizContainer');
    const quizQuestion = document.getElementById('quizQuestion');
    const quizTimer = document.getElementById('quizTimer');
    const answersGrid = document.getElementById('answersGrid');
    const lavaOcean = document.getElementById('lavaOcean');
    const roundCounter = document.getElementById('roundCounter');

    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');

    let gameSocket = null;
    let chatSocket = null;
    let localPlayers = [];
    let amIReady = false;
    let myLogin = ""; // Сюда бэк закинет наш логин при room_update

    let roundStartTime = 0;
    let lastSelectedButton = null;

    gameArena.classList.add('blur-mode');
    lobbyCodeSpan.textContent = lobbyId;

    function initGameWebSocket() {
        if (!lobbyId) return;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let wsUrl = lobbyId === 'quick' ? 
            `${protocol}//${window.location.host}/api/lavaPillars/quick` : 
            `${protocol}//${window.location.host}/api/lavaPillars/join/${lobbyId}`;

        gameSocket = new WebSocket(wsUrl);

        gameSocket.onmessage = (event) => {
    try {
        const msg = JSON.parse(event.data);
        
        if (msg.type === "room_created" && msg.lobby_id) {
            window.history.replaceState(null, '', `/Lava_Pillars/${msg.lobby_id}`);
            lobbyCodeSpan.textContent = msg.lobby_id;
        }
        if (msg.type === "room_update") {
            handleRoomUpdate(msg);
        } else if (msg.type === "game_started") {
            handleGameStart();
        } else if (msg.type === "new_round") {
            handleNewRound(msg);
        } else if (msg.type === "round_result") {
            handleRoundResult(msg);
        } else if (msg.type === "win") { // <-- ЛОВИМ ПОБЕДУ
            showGameOverWindow(true, msg.message || "Отличный результат, лава тебя не достала!");
        } else if (msg.type === "lose") { // <-- ЛОВИМ ПРОИГРЫШ
            showGameOverWindow(false, msg.message || "Твой столб поглотила лава!");
        } else if (msg.type === "game_finished") {
            console.log("Игра официально завершена на сервере");
        } else if (msg.type === "error") {
            alert(msg.message);
        }
    } catch (err) { console.error(err); }
};
    }

    window.addEventListener('beforeunload', () => {
        if (gameSocket && gameSocket.readyState === WebSocket.OPEN) {
            gameSocket.send(JSON.stringify({ type: "leave" }));
        }
    });

    function handleRoomUpdate(data) {
    localPlayers = data.players || [];
    playerCountSpan.textContent = `${localPlayers.length}/4`;
    playersList.innerHTML = '';

    localPlayers.forEach((player, index) => {
        const isCreator = index === 0;
        const playerRow = document.createElement('div');
        playerRow.className = 'player-row';
        playerRow.innerHTML = `
            <div class="player-info">
                <span class="player-avatar">${escapeHTML(player.emoji || '👤')}</span>
                <span class="player-name-link">${escapeHTML(player.login)} ${isCreator ? '👑' : ''}</span>
            </div>
            <span class="status-badge ${player.ready ? 'ready' : 'not-ready'}">${player.ready ? 'Ready' : 'Not Ready'}</span>
        `;
        playersList.appendChild(playerRow);
    });

    // СИНХРОНИЗАЦИЯ РЕЖИМА ИГРЫ
    if (data.pack) {
        const radioToSelect = document.querySelector(`input[name="gamePack"][value="${data.pack}"]`);
        if (radioToSelect) {
            radioToSelect.checked = true;
        }
    }

    const gameModeSelector = document.getElementById('gameModeSelector');
    if (gameModeSelector) {
        gameModeSelector.style.pointerEvents = 'auto'; 
    }

    const allReady = localPlayers.every(p => p.ready);
    if (allReady && localPlayers.length > 1) {
        startBtn.classList.remove('disabled');
        startBtn.disabled = false;
    } else {
        startBtn.classList.add('disabled');
        startBtn.disabled = true;
    }
    renderPillars();
}

    readyBtn.addEventListener('click', () => {
        amIReady = !amIReady;
        readyBtn.textContent = amIReady ? "Статус: Готов" : "Статус: Не готов";
        gameSocket.send(JSON.stringify({ type: amIReady ? "ready" : "unready" }));
    });

   startBtn.addEventListener('click', () => {
    gameSocket.send(JSON.stringify({ type: "start" }));
});
document.querySelectorAll('input[name="gamePack"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        // Отправляем на бэк информацию, что пак изменился
        if (gameSocket && gameSocket.readyState === WebSocket.OPEN) {
            gameSocket.send(JSON.stringify({
                type: "select_pack",
                pack: parseInt(e.target.value)
            }));
        }
    });
});


   function handleGameStart() {
        roomOverlay.style.display = 'none'; // Закрываем окно лобби
        gameArena.classList.remove('blur-mode');
        
        // Включаем оверлей отсчета
        countdownOverlay.style.display = 'flex';
        let count = 3;
        countdownNumber.textContent = count;

        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                countdownNumber.textContent = count;
            } else if (count === 0) {
                countdownNumber.textContent = "ПОГНАЛИ!";
            } else {
                clearInterval(interval);
                countdownOverlay.style.display = 'none'; // Прячем отсчет
                quizContainer.classList.add('active');   // Показываем интерфейс вопросов
            }
        }, 1000);
    }

    function handleNewRound(msg) {
        // 1. Сразу блокируем сетку и пишем промежуточный текст, разделяя раунды
        answersGrid.classList.add('loading');
        quizQuestion.textContent = "Приготовьтесь, загрузка следующего вопроса...";
        
        // Очищаем старые кнопки, чтобы они не путали игрока во время паузы
        answersGrid.innerHTML = ''; 

        // 2. Делаем паузу в 3 секунды перед показом самого вопроса
        setTimeout(() => {
            answersGrid.classList.remove('loading');
            
            roundCounter.textContent = `Раунд: ${msg.round}`;
            quizQuestion.textContent = msg.question.text;
            lastSelectedButton = null;

            msg.question.variants.forEach((variant, index) => {
                const btn = document.createElement('button');
                btn.className = 'answer-btn';
                btn.textContent = variant;
                btn.dataset.index = index;
                btn.onclick = () => handleSelectAnswer(btn, index);
                answersGrid.appendChild(btn);
            });

            roundStartTime = Date.now();
            startLocalTimer(15, 0); // Запускаем таймер только после фактического появления вопроса!
        }, 3000); // 3 секунды паузы между раундами
    }

    function handleSelectAnswer(button, variantIndex) {
        stopLocalTimer();
        const timeSpentMs = Date.now() - roundStartTime;

        // Визуально подсвечиваем, что ответ принят к рассмотрению
        document.querySelectorAll('.answer-btn').forEach(btn => btn.disabled = true);
        button.classList.add('selected');
        lastSelectedButton = button;

        gameSocket.send(JSON.stringify({
            type: "answer",
            answer: variantIndex,
            time_ms: timeSpentMs 
        }));
    }


function handleRoundResult(msg) {
    // ВАЖНО: твой бэк шлет "Correct_answer" с большой буквы C!
    const correctIdx = msg.Correct_answer; 

    // Проходимся по кнопкам и красим их
    document.querySelectorAll('.answer-btn').forEach(btn => {
        const idx = parseInt(btn.dataset.index);
        
        if (idx === correctIdx) {
            btn.classList.remove('selected');
            btn.classList.add('correct'); 
        } else if (btn.classList.contains('selected')) {
            btn.classList.remove('selected');
            btn.classList.add('wrong'); 
        }
    });

    // --- ЛОГИКА СДВИГА КАМЕРЫ НА ФРОНТЕНДЕ ---
    // Каждые 10 раундов мы виртуально опускаем всё вниз на 5 единиц (5 * 50px = 250px)
    // Вычисляем, сколько раз по 10 раундов уже прошло
    const cameraShiftsCount = Math.floor((msg.round - 1) / 8); 
    const visualShift = cameraShiftsCount * 7; // Смещение в игровых единицах

    // Обновляем высоту лавы с учетом смещения
    if (msg.lava_height) {
        // Вычитаем смещение, но не даем лаве визуально упасть ниже 1 единицы
        const visualLavaHeight = Math.max(1, msg.lava_height - visualShift);
        lavaOcean.style.height = `${visualLavaHeight * 50}px`; 
    }
    
    // Обновляем высоту столбов игроков с учетом смещения
    if (msg.players) {
        msg.players.forEach(p => {
            const bodyEl = document.getElementById(`body-${p.login}`);
            if (bodyEl) {
                // Вычитаем смещение, но не даем столбу визуально стать меньше 0
                const visualPlayerHeight = Math.max(0, p.height - visualShift);
                bodyEl.style.height = `${visualPlayerHeight * 50}px`;
                
                // Текст на столбе оставляем реальным (округленным), чтобы игроки видели свой настоящий прогресс
                bodyEl.textContent = Math.round(p.height);
            }

            if (p.login === myLogin && !p.alive) {
                showGameOverWindow(false, "Твой столб поглотила лава!");
            }
        });
    }
}

    function handleGameOver(msg) {
        // Проверяем, победили мы или проиграли по итогу всей игры
        if (msg.winner === myLogin) {
            showGameOverWindow(true, "Ты выжил и победил всех соперников!");
        } else {
            showGameOverWindow(false, `Победил игрок ${msg.winner}`);
        }
    }

    function showGameOverWindow(isWin, text) {
        quizContainer.classList.remove('active');
        gameArena.classList.add('blur-mode');
        gameOverOverlay.style.display = 'flex';
        if (isWin) {
            gameOverTitle.textContent = "🏆 Ты выиграл!";
            gameOverSub.textContent = text;
        } else {
            gameOverTitle.textContent = "💀 Ты проиграл!";
            gameOverSub.textContent = text;
            gameOverTitle.style.color = "#ff3b30";
        }
    }

    function renderPillars() {
        pillarsContainer.innerHTML = '';
        localPlayers.forEach(player => {
            const wrapper = document.createElement('div');
            wrapper.className = 'pillar-wrapper';
            wrapper.id = `pillar-${player.login}`;
            wrapper.innerHTML = `
                <span class="player-tag">${escapeHTML(player.login)}</span>
                <div class="player-token" id="token-${player.login}">${escapeHTML(player.emoji || '🔥')}</div>
                <div class="pillar-body" id="body-${player.login}" style="height: 150px;">3</div>
            `;
            pillarsContainer.appendChild(wrapper);
        });
    }

    // --- ЧАТ И ТАЙМЕР ОСТАЛИСЬ БЕЗ ИЗМЕНЕНИЙ ---
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
            quizTimer.textContent = `${displaySec.toString().padStart(2, '0')}:${displayMs.toString().padStart(2, '0')}`;
        }, 10);
    }
    function stopLocalTimer() { clearInterval(timerInterval); }
    async function initChat() {
        try {
            const res = await fetch('/api/chat/history');
            if (res.ok) {
                const history = await res.json();
                history.reverse().forEach(msg => appendChatMessage(msg));
            }
        } catch(e) {}
        chatSocket = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/chat/ws`);
        chatSocket.onmessage = (e) => { try{ appendChatMessage(JSON.parse(e.data)); }catch(err){} };
    }
    function appendChatMessage(message) {
        const div = document.createElement('div');
        div.innerHTML = `<a href="/profile/${escapeHTML(message.login)}" target="_blank" class="chat-author-link"><strong>${escapeHTML(message.emoji || '💬')} ${escapeHTML(message.login)}:</strong></a> <span>${escapeHTML(message.text)}</span>`;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if(!chatInput.value.trim() || !chatSocket) return;
        chatSocket.send(chatInput.value.trim());
        chatInput.value = '';
    });
    initGameWebSocket();
    initChat();
    function escapeHTML(str) { return str.replace(/[&<>'"]/g, t => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[t] || t)); }
});