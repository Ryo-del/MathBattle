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

    // Переменная для WebSocket соединения
    let socket = null;

    // --- 1. ЗАГРУЗКА ДАННЫХ ПРОФИЛЯ С БЭКЭНДА ---
    async function fetchUserProfile() {
        try {
            const response = await fetch('/api/user/short_profile', {
                method: 'GET',
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                
                if (data.login) headerUsername.textContent = data.login;
                if (data.emoji) headerEmoji.textContent = data.emoji;

                // Подключаем чат ТОЛЬКО после успешного получения профиля
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
        window.location.href = '/profile';
    });

    // --- 3. РАБОТА ИНТЕРФЕЙСА ЧАТА (WebSocket) ---
function initChatWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    
    // ИСПРАВЛЕНО: Добавлен префикс группы роутов бэкэнда /api/chat
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
        console.warn('WebSocket соединение закрыто. Попытка переподключения через 3 секунды...');
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

        messageElement.innerHTML = `<strong>${safeEmoji} ${safeLogin}:</strong> ${safeText}`;
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

        // Бэкэнд делает `conn.ReadMessage()` и берет `string(msg)`, поэтому шлем чистый текст
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

    // --- 4. ОБРАБОТКА НАЖАТИЯ НА КНОПКИ «ИГРАТЬ» ---
    playButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const card = e.target.closest('.game-card');
            const gameTitle = card.querySelector('.card-title').textContent;
            
            alert(`Подключение к игре "${gameTitle}"... (В разработке)`);
        });
    });
});