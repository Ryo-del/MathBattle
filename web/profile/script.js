document.addEventListener('DOMContentLoaded', () => {
    // Элементы профиля и боковой панели
    const profileEmoji = document.getElementById('profileEmoji');
    const profileLogin = document.getElementById('profileLogin');
    const profileEmail = document.getElementById('profileEmail');
    const createdAtDate = document.getElementById('createdAtDate');

    // Элементы статистики
    const lavaGames = document.getElementById('lavaGames');
    const lavaWins = document.getElementById('lavaWins');
    const formulaGames = document.getElementById('formulaGames');
    const formulaWins = document.getElementById('formulaWins');

    // Кнопки навигации
    const logoBtn = document.getElementById('logoBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    // Элементы чата (Добавлены)
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');

    let socket = null;

    // Функция извлечения логина из URL (например, из "/profile/artem" вытащит "artem")
    function getLoginFromURL() {
        const pathSegments = window.location.pathname.split('/');
        // Ожидаем структуру: ["", "profile", "username"]
        return pathSegments[2] || '';
    }

    // --- 1. ЗАГРУЗКА ДАННЫХ ПРОФИЛЯ ---
    async function loadFullProfile() {
        const login = getLoginFromURL();
        if (!login) {
            console.error('Логин не найден в URL');
            window.location.href = '/';
            return;
        }

        try {
            // Запрос идет к эндпоинту /api/user/profile/:login
            const response = await fetch(`/api/user/profile/${login}`, {
                method: 'GET',
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();

                console.log(data);
                renderProfileData(data);
                renderProfileData(data);

                // После загрузки профиля инициализируем чат (сначала история, потом сокет)
                await fetchChatHistory();
                initChatWebSocket();
            } else if (response.status === 401) {
                window.location.href = '/login';
            } else {
                console.error('Не удалось загрузить данные профиля:', response.statusText);
            }
        } catch (error) {
            console.error('Ошибка сети при загрузке профиля:', error);
        }
    }

    // Заполнение DOM-элементов данными от API
    function renderProfileData(user) {
        if (user.emoji) profileEmoji.textContent = user.emoji;
        if (user.login) profileLogin.textContent = user.login;
        if (user.email) profileEmail.textContent = user.email;

        if (user.created_at) {
            const date = new Date(user.created_at);
            createdAtDate.textContent = date.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        }

        lavaGames.textContent = user.lava_pillars_games ?? 0;
        lavaWins.textContent = user.lava_pillars_wins ?? 0;
        formulaGames.textContent = user.formula_wars_games ?? 0;
        formulaWins.textContent = user.formula_wars_wins ?? 0;
    }

    // Запускаем инициализацию страницы
    loadFullProfile();

    // --- 2. РАБОТА ОБЩЕГО ЧАТА ---

    // Подгрузка истории чата
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
                console.error('Не удалось загрузить историю чата');
            }
        } catch (error) {
            console.error('Ошибка при загрузке истории чата:', error);
        }
    }

    // Инициализация сокета
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

        socket.onclose = () => {
            console.warn('Соединение закрыто. Реконнект через 3 секунды...');
            setTimeout(initChatWebSocket, 3000);
        };

        socket.onerror = (error) => {
            console.error('Ошибка WebSocket:', error);
        };
    }

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

    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            console.error('Чат не подключен');
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

    // --- 3. ОБРАБОТКА ВЫХОДА (LOGOUT) ---
    logoutBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                window.location.href = '/login';
            } else {
                console.error('Ошибка при попытке выйти из аккаунта');
            }
        } catch (error) {
            console.error('Ошибка сети при выходе:', error);
        }
    });

    // --- 4. НАВИГАЦИЯ ---
    logoBtn.addEventListener('click', () => {
        window.location.href = '/';
    });
});