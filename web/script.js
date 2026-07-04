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

    // --- 1. ЗАГРУЗКА ДАННЫХ ПРОФИЛЯ С БЭКЭНДА ---
    async function fetchUserProfile() {
        try {
            // Запрашиваем краткие данные профиля (логин и эмодзи)
            // Маршрут защищен AuthMiddleware, поэтому обязательно передаем credentials: 'include'
            const response = await fetch('/api/user/short_profile', {
                method: 'GET',
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                
                // Динамически обновляем данные в шапке
                if (data.login) headerUsername.textContent = data.login;
                if (data.emoji) headerEmoji.textContent = data.emoji;
            } else if (response.status === 401) {
                // Если токен невалиден или отсутствует — отправляем обратно на авторизацию
                window.location.href = '/login';
            }
        } catch (error) {
            console.error('Ошибка при получении профиля:', error);
        }
    }

    // Вызываем функцию загрузки при старте страницы
    fetchUserProfile();

    // --- 2. КЛИК ПО ПРОФИЛЮ (Опциональное меню / Выход) ---
    userProfileBtn.addEventListener('click', () => {
        // Здесь можно открыть выпадающее меню или предложить выйти
        const confirmLogout = confirm('Вы хотите выйти из аккаунта?');
        if (confirmLogout) {
            logoutUser();
        }
    });

    // Функция для выхода из системы (удаление куки через бэкэнд)
    async function logoutUser() {
        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
            if (response.ok) {
                window.location.href = '/login';
            }
        } catch (error) {
            console.error('Ошибка при выходе:', error);
        }
    }

    // --- 3. РАБОТА ИНТЕРФЕЙСА ЧАТА (Фронтенд-заглушка) ---
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const messageText = chatInput.value.trim();
        if (!messageText) return;

        // Создаем элемент нового сообщения
        const messageElement = document.createElement('div');
        messageElement.style.marginBottom = '8px';
        
        // Берем текущий логин из шапки для автора сообщения
        const currentUser = headerUsername.textContent;
        const currentEmoji = headerEmoji.textContent;

        messageElement.innerHTML = `<strong>${currentEmoji} ${currentUser}:</strong> ${escapeHTML(messageText)}`;
        
        chatMessages.appendChild(messageElement);
        
        // Скроллим чат вниз к новому сообщению
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
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
            // В будущем здесь будет логика инициализации WebSocket-соединения или редирект в игровую комнату
        });
    });
});