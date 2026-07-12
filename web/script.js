document.addEventListener('DOMContentLoaded', () => {
    // Элементы шапки профиля
    const headerUsername = document.getElementById('headerUsername');
    const headerEmoji = document.getElementById('headerEmoji');
    const userProfileBtn = document.getElementById('userProfileBtn');

    // Элементы чата
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');

    // Кнопки запуска игр и модальное окно
    const playButtons = document.querySelectorAll('.play-btn');
    const lobbyModal = document.getElementById('lobbyModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const btnCreateLobby = document.getElementById('btnCreateLobby');
    const btnQuickJoin = document.getElementById('btnQuickJoin');
    const btnJoinByCode = document.getElementById('btnJoinByCode');
    const lobbyCodeInput = document.getElementById('lobbyCodeInput');

    // Переменная для отслеживания выбранной в данный момент игры ("Lava Pillars" или "Formula Wars")
    let currentSelectedGame = "";

    // 1. ОБРАБОТКА КЛИКА ПО КАРТОЧКАМ ИГР
    playButtons.forEach(button => {
    button.addEventListener('click', (e) => {
        // ЕСЛИ КНОПКА ЗАБЛОКИРОВАНА — ИГНОРИРУЕМ КЛИК
        if (e.target.hasAttribute('disabled')) {
            return; 
        }

        const card = e.target.closest('.game-card');
        const gameTitle = card.querySelector('.card-title').textContent.trim();
        
        if (gameTitle === "Lava Pillars" || gameTitle === "Formula Wars") {
            currentSelectedGame = gameTitle;
            
            const modalTitle = lobbyModal.querySelector('.modal-title');
            if (modalTitle) modalTitle.textContent = gameTitle;

            lobbyModal.classList.add('active');
        } else {
            alert(`Подключение к игре "${gameTitle}"... (В разработке)`);
        }
    });
});

    // Управление закрытием модального окна
    closeModalBtn.addEventListener('click', () => {
        lobbyModal.classList.remove('active');
        lobbyCodeInput.value = '';
    });

    lobbyModal.addEventListener('click', (e) => {
        if (e.target === lobbyModal) {
            lobbyModal.classList.remove('active');
            lobbyCodeInput.value = '';
        }
    });

    // 2. КНОПКА: СОЗДАТЬ ЛОББИ (Динамическое создание через WebSocket)
    btnCreateLobby.addEventListener('click', async () => {
        if (!currentSelectedGame) return;

        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            let wsRoute = "";
            let redirectPrefix = "";

            // Определяем эндпоинты в зависимости от выбранной игры
            if (currentSelectedGame === "Formula Wars") {
                wsRoute = "/api/formulaWars/create";
                redirectPrefix = "/Formula_Wars";
            } else {
                wsRoute = "/api/lavaPillars/create";
                redirectPrefix = "/Lava_Pillars";
            }

            const ws = new WebSocket(`${protocol}//${window.location.host}${wsRoute}`);
            
            ws.onmessage = (event) => {
                const res = JSON.parse(event.data);
                if (res.type === "room_created" && res.lobby_id) {
                    ws.close();
                    // Перенаправляем в созданную комнату
                    window.location.href = `${redirectPrefix}/${res.lobby_id}`;
                }
            };

            ws.onerror = (err) => {
                console.error(`Ошибка WebSocket при создании комнаты для ${currentSelectedGame}:`, err);
                alert("Не удалось создать комнату. Возможно, вы не авторизованы.");
            };
        } catch (error) {
            console.error('Ошибка при создании лобби:', error);
        }
    });

    // 3. КНОПКА: БЫСТРЫЙ ПОИСК
    btnQuickJoin.addEventListener('click', () => {
        if (!currentSelectedGame) return;

        if (currentSelectedGame === "Formula Wars") {
            window.location.href = `/Formula_Wars/quick`;
        } else {
            window.location.href = `/Lava_Pillars/quick`;
        }
    });

    // 4. КНОПКА: ПОДКЛЮЧЕНИЕ ПО КОДУ
    btnJoinByCode.addEventListener('click', () => {
        if (!currentSelectedGame) return;

        const code = lobbyCodeInput.value.trim().toUpperCase();
        if (!code) {
            alert('Пожалуйста, введите код комнаты.');
            return;
        }
        if (code.length !== 4) {
            alert('Код комнаты должен состоять из 4 символов.');
            return;
        }

        if (currentSelectedGame === "Formula Wars") {
            window.location.href = `/Formula_Wars/${code}`;
        } else {
            window.location.href = `/Lava_Pillars/${code}`;
        }
    });

    // Отправка кода по нажатию Enter
    lobbyCodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            btnJoinByCode.click();
        }
    });

    // Переменные состояния профиля и чата
    let socket = null;
    let currentUserLogin = '';

    // 5. ЗАГРУЗКА ДАННЫХ ПРОФИЛЯ С БЭКЭНДА
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
                    currentUserLogin = data.login;
                }
                if (data.emoji) headerEmoji.textContent = data.emoji;

                await fetchChatHistory();
                initChatWebSocket();
            } else if (response.status === 401) {
                window.location.href = '/login';
            }
        } catch (error) {
            console.error('Ошибка при получении профиля:', error);
        }
    }

    fetchUserProfile();

    userProfileBtn.addEventListener('click', () => {
        if (currentUserLogin) {
            window.location.href = `/profile/${currentUserLogin}`;
        } else {
            window.location.href = '/login';
        }
    });

    // 6. РАБОТА ИНТЕРФЕЙСА ЧАТА (История и WebSocket)
    async function fetchChatHistory() {
        try {
            const response = await fetch('/api/chat/history', {
                method: 'GET',
                credentials: 'include'
            });

            if (response.ok) {
                const messages = await response.json();
                if (messages && messages.length > 0) {
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
            console.warn('WebSocket соединения чата закрыто. Переподключение...', event.reason);
            setTimeout(initChatWebSocket, 3000);
        };

        socket.onerror = (error) => {
            console.error('Ошибка WebSocket чата:', error);
        };
    }

    function appendMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.style.marginBottom = '8px';
        
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
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            console.error('Невозможно отправить сообщение: сокет не подключен');
            return;
        }

        const messageText = chatInput.value.trim();
        if (!messageText) return;

        socket.send(messageText);
        chatInput.value = '';
    });

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }
});