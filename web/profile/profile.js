document.addEventListener('DOMContentLoaded', async () => {
    const BASE_URL = '/api';

    // проверка авторизации
    const res = await fetch(`${BASE_URL}/user/profile`, {
        method: 'GET',
        credentials: 'include'
    });

    if (res.status === 401) {
        window.location.href = '/login';
        return;
    }

    loadProfile();
});
    // Логика кнопки "Выйти"
 document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
    } catch (e) {
        console.error(e);
    }

    localStorage.clear();
    window.location.href = '/login';
});


    // Функция загрузки данных профиля с бэка
   async function loadProfileData() {
    try {
        const response = await fetch(`${BASE_URL}/user/profile`, {
            method: 'GET',
            credentials: 'include', // 🔥 ВАЖНО
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }

        const data = await response.json();

        document.getElementById('profileLogin').textContent = data.login;
        document.getElementById('profileEmoji').textContent = data.emoji;
        document.getElementById('profileEmail').textContent = data.email;

        if (data.created_at) {
            const date = new Date(data.created_at);
            document.getElementById('createdAtDate').textContent =
                date.toLocaleDateString('ru-RU');
        }

        document.getElementById('lavaGames').textContent = data.lava_pillars_games;
        document.getElementById('lavaWins').textContent = data.lava_pillars_wins;
        document.getElementById('formulaGames').textContent = data.formula_wars_games;
        document.getElementById('formulaWins').textContent = data.formula_wars_wins;

    } catch (err) {
        console.error("Ошибка API:", err);
    }
}

loadProfileData();