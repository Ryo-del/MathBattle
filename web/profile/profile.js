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

    // --- 1. ЗАГРУЗКА ДАННЫХ ПРОФИЛЯ ---
    async function loadFullProfile() {
        try {
            // Делаем запрос к полному профилю (/api/user/profile)
            const response = await fetch('/api/user/profile', {
                method: 'GET',
                credentials: 'include' // Передаем JWT-куку
            });

            if (response.ok) {
                const data = await response.json();
                renderProfileData(data);
            } else if (response.status === 401) {
                // Если сессия истекла или токена нет, отправляем на авторизацию
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

        // Форматирование даты регистрации
        if (user.created_at) {
            const date = new Date(user.created_at);
            createdAtDate.textContent = date.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        }

        // Заполнение счётчиков статистики
        lavaGames.textContent = user.lava_pillars_games ?? 0;
        lavaWins.textContent = user.lava_pillars_wins ?? 0;
        formulaGames.textContent = user.formula_wars_games ?? 0;
        formulaWins.textContent = user.formula_wars_wins ?? 0;
    }

    // ИСПРАВЛЕНО: Вызываем функцию по её ТОЧНОМУ имени
    loadFullProfile();

    // --- 2. ОБРАБОТКА ВЫХОДА (LOGOUT) ---
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

    // --- 3. НАВИГАЦИЯ ---
    logoBtn.addEventListener('click', () => {
        window.location.href = '/';
    });
});