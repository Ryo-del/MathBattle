document.addEventListener('DOMContentLoaded', () => {
    // Элементы шапки профиля
    const headerUsername = document.getElementById('headerUsername');
    const headerEmoji = document.getElementById('headerEmoji');
    const userProfileBtn = document.getElementById('userProfileBtn');

    // Элементы чата
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');

    // Кнопки запуска игр
    const playButtons = document.querySelectorAll('.play-btn');
    const lobbyModal = document.getElementById('lobbyModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const btnCreateLobby = document.getElementById('btnCreateLobby');
    const btnQuickJoin = document.getElementById('btnQuickJoin');
    const btnJoinByCode = document.getElementById('btnJoinByCode');
    const lobbyCodeInput = document.getElementById('lobbyCodeInput');
    playButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const card = e.target.closest('.game-card');
            const gameTitle = card.querySelector('.card-title').textContent.trim();
            
            if (gameTitle === "Lava Pillars") {
                // Показываем окно добавлением класса active
                lobbyModal.classList.add('active');
            } else {
                alert(`Подключение к игре "${gameTitle}"... (В разработке)`);
            }
        });
    });
   btnCreateLobby.addEventListener('click', async () => {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            // ИСПРАВЛЕНО: Маршрут изменен на /api/lavaPillars/create
            const ws = new WebSocket(`${protocol}//${window.location.host}/api/lavaPillars/create`);
            
            ws.onmessage = (event) => {
                const res = JSON.parse(event.data);
                if (res.type === "room_created" && res.lobby_id) {
                    ws.close();
                    window.location.href = `/Lava_Pillars/${res.lobby_id}`;
                }
            };
        } catch (error) {
            console.error('Ошибка при создании лобби:', error);
        }
    });
    closeModalBtn.addEventListener('click', () => {
        lobbyModal.classList.remove('active');
        lobbyCodeInput.value = '';
    });

    // Закрытие модального окна при клике на полупрозрачный фон вокруг окна
    lobbyModal.addEventListener('click', (e) => {
        if (e.target === lobbyModal) {
            lobbyModal.classList.remove('active');
            lobbyCodeInput.value = '';
        }
    });
   // Кнопка 1: СОЗДАТЬ ЛОББИ
    btnCreateLobby.addEventListener('click', async () => {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            // Используем правильный роут с префиксом /api/lavaPillars
            const ws = new WebSocket(`${protocol}//${window.location.host}/api/lavaPillars/create`);
            
            ws.onmessage = (event) => {
                const res = JSON.parse(event.data);
                if (res.type === "room_created" && res.lobby_id) {
                    ws.close();
                    // Перенаправляем на страницу игры с ID созданной комнаты
                    window.location.href = `/Lava_Pillars/${res.lobby_id}`;
                }
            };

            ws.onerror = (err) => {
                console.error("Ошибка WebSocket при создании комнаты:", err);
                alert("Не удалось создать комнату. Возможно, вы не авторизованы.");
            };
        } catch (error) {
            console.error('Ошибка при создании лобби:', error);
        }
    });

  // Кнопка 2: БЫСТРЫЙ ПОИСК
  btnQuickJoin.addEventListener('click', () => {
        window.location.href = `/Lava_Pillars/quick`;
    });

    // Кнопка 3: ПОДКЛЮЧЕНИЕ ПО КОДУ
    btnJoinByCode.addEventListener('click', () => {
        const code = lobbyCodeInput.value.trim().toUpperCase();
        if (!code) {
            alert('Пожалуйста, введите код комнаты.');
            return;
        }
        if (code.length !== 4) {
            alert('Код комнаты должен состоять из 4 символов.');
            return;
        }
        // Переходим в комнату по коду
        window.location.href = `/Lava_Pillars/${code}`;
    });

   // Позволяем отправлять код комнаты кнопкой Enter на клавиатуре
    lobbyCodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            btnJoinByCode.click();
        }
    });
    // Переменная для WebSocket соединения
    let socket = null;
    let currentUserLogin = '';
    // --- 1. ЗАГРУЗКА ДАННЫХ ПРОФИЛЯ С БЭКЭНДА ---
    async function fetchUserProfile() {
        try {
            const response = await fetch('/api/user/short_profile', {
                method: 'GET',
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                
                if (data.login) {
                    headerUsername.textContent = data.login;
                    currentUserLogin = data.login; // ИСПРАВЛЕНО: Сохраняем логин для последующего перехода
                }
                if (data.emoji) headerEmoji.textContent = data.emoji;

                // СНАЧАЛА подгружаем историю, ЗАТЕМ открываем вебсокет
                await fetchChatHistory();
                initChatWebSocket();
            } else if (response.status === 401) {
                window.location.href = '/login';
            }
        } catch (error) {
            console.error('Ошибка при получении профиля:', error);
        }
    }

    // Вызываем функцию загрузки при старте страницы
    fetchUserProfile();

    // --- 2. КЛИК ПО ПРОФИЛЮ ПЕРЕХОД В ЛИЧНЫЙ КАБИНЕТ ---
    userProfileBtn.addEventListener('click', () => {
        // ИСПРАВЛЕНО: Перенаправляем на динамический роут, если логин успел загрузиться
        if (currentUserLogin) {
            window.location.href = `/profile/${currentUserLogin}`;
        } else {
            // Фолбек на случай, если пользователь кликнул до завершения fetch-запроса
            window.location.href = '/login';
        }
    });

    // --- 3. РАБОТА ИНТЕРФЕЙСА ЧАТА (История и WebSocket) ---

    // Подгрузка истории чата с бэкэнда
    async function fetchChatHistory() {
        try {
            // Маршрут /api/chat/history защищен AuthMiddleware бэкэнда
            const response = await fetch('/api/chat/history', {
                method: 'GET',
                credentials: 'include'
            });

            if (response.ok) {
                const messages = await response.json();
                
                // Проверяем, что вернулся не пустой массив
                if (messages && messages.length > 0) {
                    // Разворачиваем массив обратно (чтобы старые были вверху, а новые внизу)
                    messages.reverse().forEach(message => {
                        appendMessage(message);
                    });
                }
            } else {
                console.error('Не удалось загрузить историю чата:', response.statusText);
            }
        } catch (error) {
            console.error('Ошибка при загрузке истории чата:', error);
        }
    }
    // --- ИНИЦИАЛИЗАЦИЯ ИГРОВОГО ВЕБСОКЕТА ---
    function initGameWebSocket() {
        if (!lobbyId) return;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        
        let wsUrl = '';
        // Если в URL написано 'quick', подключаемся к ручке быстрого поиска
        if (lobbyId === 'quick') {
            wsUrl = `${protocol}//${window.location.host}/api/lavaPillars/quick`;
        } else {
            // Иначе подключаемся к конкретной комнате по её ID
            wsUrl = `${protocol}//${window.location.host}/api/lavaPillars/join/${lobbyId}`;
        }

        gameSocket = new WebSocket(wsUrl);

        gameSocket.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                
                // 1. ОБРАБОТКА СОБЫТИЯ НАЧАЛА ИГРЫ И ПОЛУЧЕНИЯ РЕАЛЬНОГО LOBBY_ID
                if (msg.type === "game_started" && msg.data && msg.data.lobby_id) {
                    const realLobbyId = msg.data.lobby_id;
                    
                    // Обновляем глобальную переменную lobbyId, чтобы логика работала верно
                    lobbyId = realLobbyId; 
                    
                    // Меняем 'quick' в адресной строке на реальный ID (например, ABCD) без перезагрузки страницы
                    window.history.replaceState(null, '', `/Lava_Pillars/${realLobbyId}`);
                    
                    // Если на экране есть элемент, отображающий код комнаты, обновляем его текст
                    const lobbyCodeSpan = document.getElementById('lobbyCodeSpan');
                    if (lobbyCodeSpan) {
                        lobbyCodeSpan.textContent = realLobbyId;
                    }
                    
                    // Вызываем твой внутренний обработчик старта игры (если он есть)
                    if (typeof handleGameStart === 'function') {
                        handleGameStart(msg.data);
                    }
                    return;
                }

                // 2. ОБРАБОТКА ОБНОВЛЕНИЯ КОМНАТЫ (Список игроков, статусы готовности)
                if (msg.type === "room_update") {
                    if (typeof handleRoomUpdate === 'function') {
                        handleRoomUpdate(msg);
                    }
                } 
                // 3. ОБРАБОТКА ОШИБОК ОТ БЭКЭНДА
                else if (msg.type === "error") {
                    alert(msg.message || "Произошла ошибка в комнате");
                }
            } catch (err) {
                console.error("Ошибка при обработке сообщения от игрового сокета:", err);
            }
        };

        gameSocket.onclose = (e) => {
            console.warn("Соединение с игровой комнатой закрыто. Код:", e.code);
            // Автоматический реконнект через 3 секунды, если это не было намеренным закрытием
            if (e.code !== 1000) {
                setTimeout(initGameWebSocket, 3000);
            }
        };

        gameSocket.onerror = (err) => {
            console.error("Ошибка WebSocket соединения игры:", err);
        };
    }
    // Инициализация WebSocket-соединения
    function initChatWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/chat/ws`;

        socket = new WebSocket(wsUrl);

        socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                appendMessage(message);
            } catch (err) {
                console.error('Ошибка парсинга сообщения чата:', err);
            }
        };

        socket.onclose = (event) => {
            console.warn('WebSocket соединение закрыто. Попытка переподключения через 3 секунды...', event.reason);
            setTimeout(initChatWebSocket, 3000);
        };

        socket.onerror = (error) => {
            console.error('Ошибка WebSocket:', error);
        };
    }

    // Функция отрисовки сообщения в DOM
    function appendMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.style.marginBottom = '8px';
        
        // Экранируем текст, защищаясь от XSS
        const safeText = escapeHTML(message.text);
        const safeLogin = escapeHTML(message.login);
        const safeEmoji = escapeHTML(message.emoji || '💬');

        messageElement.innerHTML = `
            <a href="/profile/${safeLogin}" class="chat-author-link">
                <strong>${safeEmoji} ${safeLogin}:</strong>
            </a> 
            <span>${safeText}</span>
        `;
        chatMessages.appendChild(messageElement);
        
        // Скроллим чат вниз
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Отправка формы (отправка сообщения в сокет)
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            console.error('Невозможно отправить сообщение: сокет не подключен');
            return;
        }

        const messageText = chatInput.value.trim();
        if (!messageText) return;

        socket.send(messageText);
        
        // Очищаем поле ввода
        chatInput.value = '';
    });

    // Вспомогательная функция защиты от XSS атак в чате
    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

   
});