document.addEventListener('DOMContentLoaded', () => {
    // Извлекаем ID комнаты из URL строки (например, /Formula_Wars/ABCD)
    const pathSegments = window.location.pathname.split('/');
    const lobbyId = pathSegments[pathSegments.length - 1] || '';
    
    // DOM-элементы интерфейса комнаты (Лобби)
    const roomOverlay = document.getElementById('roomOverlay');
    const countdownOverlay = document.getElementById('countdownOverlay');
    const countdownNumber = document.getElementById('countdownNumber');
    const gameOverOverlay = document.getElementById('gameOverOverlay');
    const gameOverTitle = document.getElementById('gameOverTitle');
    const gameOverSub = document.getElementById('gameOverSub');
    const gameArena = document.getElementById('gameArena');
    const lobbyCodeSpan = document.getElementById('lobbyCode');
    const playerCountSpan = document.getElementById('playerCount');
    const playersList = document.getElementById('playersList');
    const readyBtn = document.getElementById('readyBtn');
    const startBtn = document.getElementById('startBtn');
    const roundCounter = document.getElementById('roundCounter');
    
    // Canvas элементы для координатной плоскости 20х20
    const canvas = document.getElementById('battleCanvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
    const formulaInput = document.getElementById('formulaInput');
    const shootBtn = document.getElementById('shootBtn');
    
    // Элементы общего чата
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');

    let gameSocket = null;
    let chatSocket = null;
    let isReady = false;

    // Установка кода комнаты на экране
    if (lobbyCodeSpan) lobbyCodeSpan.textContent = lobbyId;

    // --- ФУНКЦИИ ОТРИСОВКИ ИГРОВОГО ПОЛЯ (CANVAS) ---
   // --- ОБНОВЛЕННАЯ ОТРИСОВКА В СТИЛЕ GRAPHWAR ---
    function drawBoard(gameState) {
        if (!canvas || !ctx) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const mapSize = 20;
        const cellSize = canvas.width / mapSize;

        // 1. Рисуем сетку
        ctx.strokeStyle = "rgba(0, 0, 0, 0.05)";
        ctx.lineWidth = 1;
        for (let i = 0; i <= mapSize; i++) {
            ctx.beginPath();
            ctx.moveTo(i * cellSize, 0);
            ctx.lineTo(i * cellSize, canvas.height);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(0, i * cellSize);
            ctx.lineTo(canvas.width, i * cellSize);
            ctx.stroke();
        }

        // 2. Рисуем главные математические оси (X и Y) по центру (на отметке 10 клеток)
        ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
        ctx.lineWidth = 2;
        // Ось X
        ctx.beginPath();
        ctx.moveTo(0, 10 * cellSize);
        ctx.lineTo(canvas.width, 10 * cellSize);
        ctx.stroke();
        // Ось Y
        ctx.beginPath();
        ctx.moveTo(10 * cellSize, 0);
        ctx.lineTo(10 * cellSize, canvas.height);
        ctx.stroke();

        if (!gameState) return;

        // 3. Отрисовка препятствий
        if (gameState.objects) {
            gameState.objects.forEach(obj => {
                if (obj.hp > 0) {
                    ctx.fillStyle = obj.destructible ? "#d97706" : "#4b5563";
                    ctx.fillRect(obj.x * cellSize + 1, obj.y * cellSize + 1, cellSize - 2, cellSize - 2);
                }
            });
        }

        // 4. Отрисовка игроков
        if (gameState.players) {
            gameState.players.forEach(p => {
                if (!p.alive) return;

                // Точка игрока
                ctx.fillStyle = "#2563eb";
                ctx.beginPath();
                ctx.arc(p.x * cellSize + cellSize / 2, p.y * cellSize + cellSize / 2, cellSize / 2 - 3, 0, Math.PI * 2);
                ctx.fill();

                // Ник / Эмодзи
                ctx.fillStyle = "#000000";
                ctx.font = `${cellSize * 0.5}px sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(p.player.emoji || "🕹️", p.x * cellSize + cellSize / 2, p.y * cellSize + cellSize / 2);

                // Хитбар
                const barWidth = cellSize * 0.8;
                const barX = p.x * cellSize + (cellSize - barWidth) / 2;
                const barY = p.y * cellSize - 6;
                ctx.fillStyle = "rgba(0,0,0,.1)";
                ctx.fillRect(barX, barY, barWidth, 4);
                ctx.fillStyle = getHPColor(p.hp, 100);
                ctx.fillRect(barX, barY, barWidth * (p.hp / 100), 4);
            });
        }
    }

    // --- АНИМАЦИЯ СТРОЯЩЕГОСЯ ГРАФИКА ФУНКЦИИ ---
    function animateProjectile(path, onComplete) {
        if (!path || path.length === 0) {
            if (onComplete) onComplete();
            return;
        }

        let pointIndex = 0;
        const mapSize = 20;
        const cellSize = canvas.width / mapSize;

        // Сохраняем чистую карту перед выстрелом
        const savedData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        function frame() {
            if (pointIndex >= path.length) {
                if (onComplete) onComplete();
                return;
            }

            // Возвращаем исходную карту
            ctx.putImageData(savedData, 0, 0);

            // Рисуем линию графика от начала до текущей точки
            ctx.strokeStyle = "#ef4444"; 
            ctx.lineWidth = 3;
            ctx.beginPath();
            
            // Старт линии из первой точки траектории
            ctx.moveTo(path[0].x * cellSize, path[0].y * cellSize);
            for (let i = 1; i <= pointIndex; i++) {
                ctx.lineTo(path[i].x * cellSize, path[i].y * cellSize);
            }
            ctx.stroke();

            // Рисуем саму летящую "каретку" (снаряд) на конце линии
            const pt = path[pointIndex];
            ctx.fillStyle = "#b91c1c";
            ctx.beginPath();
            ctx.arc(pt.x * cellSize, pt.y * cellSize, 6, 0, Math.PI * 2);
            ctx.fill();

            pointIndex += 4; // Скорость анимации (шаг по массиву точек)
            requestAnimationFrame(frame);
        }

        requestAnimationFrame(frame);
    }



    // --- РАБОТА С ВЕБСОКЕТАМИ ИГРЫ ---
    function initGameWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        gameSocket = new WebSocket(`${protocol}//${window.location.host}/api/formulaWars/join/${lobbyId}`);

        gameSocket.onopen = () => {
            console.log("Успешное подключение к игровому серверу Formula Wars");
        };

        gameSocket.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                console.log("WS:", msg);
                
                if (msg.type === "room_update") {
                    updateLobbyUI(msg.players);
                } else if (msg.type === "game_started") {

    roomOverlay.style.display = 'none';

    gameArena.classList.remove('blur-mode');

   const myID = Number(localStorage.getItem("user_id"));

if (msg.active_player_id === myID) {
    formulaInput.disabled = false;
    shootBtn.disabled = false;
} else {
    formulaInput.disabled = true;
    shootBtn.disabled = true;
}
                } else if (msg.type === "turn_result") {
                    // Блокируем ввод во время отображения анимации чужого хода
                    if (formulaInput) formulaInput.disabled = true;
                    if (shootBtn) shootBtn.disabled = true;

                    if (msg.formula && roundCounter) {
                        roundCounter.textContent = `Выстрел: f(x) = ${msg.formula}`;
                    }

                    animateProjectile(msg.path, () => {
                        // После анимации перерисовываем финальное состояние карты
                        const state = msg.target_state;
                        drawBoard(state);

                        // Разблокируем элементы управления, если пришёл черёд делать ход
                        if (formulaInput) formulaInput.disabled = false;
                        if (shootBtn) shootBtn.disabled = false;
                        if (formulaInput) formulaInput.value = '';
                    });
                } else if (msg.type === "game_state") {
                    // Обычное синхронное обновление состояния
                    drawBoard(msg);
                } else if (msg.type === "win") {
                    showGameOver(true, msg.message);
                } else if (msg.type === "lose") {
                    showGameOver(false, msg.message);
                } else if (msg.type === "turn_started") {
                drawBoard(msg.state);

                if (roundCounter) {
                    roundCounter.textContent = `Ход игрока ${msg.active_player_id}`;
                }

                formulaInput.disabled = false;
                shootBtn.disabled = false;
                } else if (msg.type === "error") {
                    alert("Ошибка от сервера: " + msg.message);
                }
            } catch (err) {
                console.error("Ошибка при обработке сообщения вебсокета игры:", err);
            }
        };

        gameSocket.onclose = () => {
            console.log("Соединение с игровым сервером разорвано");
        };
    }

    // Обновление списка игроков внутри стартового оверлея лобби
    function updateLobbyUI(players) {
        if (!playersList || !playerCountSpan || !startBtn) return;

        playersList.innerHTML = '';
        playerCountSpan.textContent = `${players.length}/4`;

        let allReady = true;

        players.forEach(p => {
            const div = document.createElement('div');
            div.className = 'player-item';
            div.innerHTML = `
                <span>${escapeHTML(p.emoji || '👤')} ${escapeHTML(p.login)}</span>
                <span style="color: ${p.ready ? '#34c759' : '#ff3b30'}">${p.ready ? 'Готов' : 'Не готов'}</span>
            `;
            playersList.appendChild(div);

            if (!p.ready) {
                allReady = false;
            }
        });

        // Кнопку старта может нажать создатель, только когда все готовы
        if (allReady && players.length >= 1) {
            startBtn.classList.remove('disabled');
            startBtn.disabled = false;
        } else {
            startBtn.classList.add('disabled');
            startBtn.disabled = true;
        }
    }

    // --- ОБРАБОТЧИКИ СОБЫТИЙ ИНТЕРФЕЙСА (Клик на кнопки лобби) ---
    if (readyBtn) {
        readyBtn.addEventListener('click', () => {
            isReady = !isReady;
            readyBtn.textContent = isReady ? "Статус: Готов" : "Статус: Не готов";
            readyBtn.className = isReady ? "btn btn-success" : "btn btn-secondary";

            if (gameSocket && gameSocket.readyState === WebSocket.OPEN) {
                gameSocket.send(JSON.stringify({ type: isReady ? "ready" : "unready" }));
            }
        });
    }

    if (startBtn) {
        startBtn.addEventListener('click', () => {
            if (gameSocket && gameSocket.readyState === WebSocket.OPEN) {
                gameSocket.send(JSON.stringify({ type: "start" }));
            }
        });
    }

    // --- ОТПРАВКА ИГРОВЫХ ФОРМУЛ ---
    function submitFormula() {
        if (!formulaInput || !shootBtn || formulaInput.disabled) return;
        const val = formulaInput.value.trim();
        if (!val) return;

        if (gameSocket && gameSocket.readyState === WebSocket.OPEN) {
            // Формируем payload согласно структуре Go ActionMessage
            const payload = {
                action: "shoot",
                formula: val
            };

            gameSocket.send(JSON.stringify({
                type: "game_action",
                data: payload
            }));
            
            // Временно блокируем до ответа сервера
            formulaInput.disabled = true;
            shootBtn.disabled = true;
        }
    }

    if (shootBtn) {
        shootBtn.addEventListener('click', submitFormula);
    }
    if (formulaInput) {
        formulaInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                submitFormula();
            }
        });
    }

    // Вывод экрана завершения матча
    function showGameOver(isWin, text) {
        if (!gameOverOverlay || !gameOverTitle || !gameOverSub) return;
        gameOverTitle.textContent = isWin ? "🏆 Победа!" : "💀 Игра окончена";
        gameOverSub.textContent = text || "";
        gameOverOverlay.style.display = 'flex';
    }

    // Динамический цвет для полосок здоровья
    function getHPColor(current, max) {
        const percentage = current / max;
        if (percentage > 0.5) return "#34c759"; // Зеленый
        if (percentage > 0.2) return "#ff9500"; // Оранжевый
        return "#ff3b30"; // Красный
    }

    // --- ИНИЦИАЛИЗАЦИЯ ЧАТА (Использует глобальный хаб из main.go) ---\
    async function initChat() {
        if (!chatMessages || !chatForm || !chatInput) return;
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        chatSocket = new WebSocket(`${protocol}//${window.location.host}/api/chat/ws`);
        
        chatSocket.onmessage = (e) => {
            try {
                const message = JSON.parse(e.data);
                const div = document.createElement('div');
                div.innerHTML = `<strong>${escapeHTML(message.emoji || '💬')} ${escapeHTML(message.login)}:</strong> <span>${escapeHTML(message.text)}</span>`;
                chatMessages.appendChild(div);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            } catch (err) {}
        };
    }

    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!chatInput.value.trim() || !chatSocket) return;
            chatSocket.send(chatInput.value.trim());
            chatInput.value = '';
        });
    }

    // Запуск подключений
    initGameWebSocket();
    initChat();

    // Защита от XSS атак
    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>'\"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }
});