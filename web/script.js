document.addEventListener('DOMContentLoaded', () => {
    const BASE_URL = '/api';

    // 🔐 Загрузка профиля в хедере
    async function loadHeaderProfile() {
        try {
            const response = await fetch(`${BASE_URL}/user/short_profile`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // ❌ нет авторизации
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }

            const data = await response.json();

            document.getElementById('headerUsername').textContent =
                data.login || 'User';

            document.getElementById('headerEmoji').textContent =
                data.emoji || '👤';

        } catch (err) {
            console.error("Ошибка загрузки профиля:", err);

            document.getElementById('headerUsername').textContent = 'User';
            document.getElementById('headerEmoji').textContent = '👤';
        }
    }

    loadHeaderProfile();

    // 👤 Клик по профилю
    const profileBtn = document.getElementById('userProfileBtn');

    if (profileBtn) {
        profileBtn.addEventListener('click', () => {
            window.location.href = '/profile';
        });
    }

    // 💬 Чат (локальный UI)
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');

    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const text = chatInput.value.trim();
            if (!text) return;

            const msgDiv = document.createElement('div');
            msgDiv.className = 'message';
            msgDiv.style.alignSelf = 'flex-end';
            msgDiv.style.background = 'rgba(0, 113, 227, 0.1)';

            msgDiv.innerHTML = `<span class="msg-author">Вы:</span> ${text}`;

            chatMessages.appendChild(msgDiv);

            chatInput.value = '';
            chatMessages.scrollTop = chatMessages.scrollHeight;
        });
    }

    // 🎮 Кнопки "Играть"
    const playButtons = document.querySelectorAll('.play-btn');

    playButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const titleEl = e.target.closest('.card')?.querySelector('.card-title');

            const gameName = titleEl?.textContent || 'Игра';

            alert(`Подключение к лобби игры: ${gameName}`);
        });
    });
});