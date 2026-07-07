document.addEventListener('DOMContentLoaded', () => {
    // Элементы переключения вкладок и форм
    const tabLogin = document.getElementById('tabLogin');
    const tabSignup = document.getElementById('tabSignup');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const msgBox = document.getElementById('msgBox');

    // Элементы смены языка
    const langSwitcher = document.getElementById('langSwitcher');

    // Переводы для локализации
    const translations = {
        RU: {
            loginTab: "Вход",
            signupTab: "Регистрация",
            loginPlaceholder: "Email или логин",
            passwordPlaceholder: "Пароль",
            usernamePlaceholder: "Логин",
            emojiPlaceholder: "Выбери статус-эмодзи (😎, 🚀)",
            rememberMe: "Не выходить из аккаунта",
            loginBtn: "Войти",
            signupBtn: "Создать аккаунт",
            errorEmpty: "Пожалуйста, заполните все обязательные поля",
            successLogin: "Успешный вход! Перенаправление...",
            successSignup: "Аккаунт создан! Перенаправление..."
        },
        EN: {
            loginTab: "Sign In",
            signupTab: "Sign Up",
            loginPlaceholder: "Email or username",
            passwordPlaceholder: "Password",
            usernamePlaceholder: "Username",
            emojiPlaceholder: "Choose emoji status (😎, 🚀)",
            rememberMe: "Keep me signed in",
            loginBtn: "Sign In",
            signupBtn: "Create Account",
            errorEmpty: "Please fill in all required fields",
            successLogin: "Success! Redirecting...",
            successSignup: "Account created! Redirecting..."
        }
    };

    let currentLang = 'RU';

    // Вспомогательная функция для отображения уведомлений
    function showMessage(message, isError = true) {
    msgBox.textContent = message;
    msgBox.classList.remove('error', 'success');
    msgBox.classList.add(isError ? 'error' : 'success');
    
    msgBox.classList.add('show');
}

function clearMessage() {
    msgBox.textContent = '';
    
    msgBox.classList.remove('show');
}

    // --- 1. ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ---
    tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabSignup.classList.remove('active');
        loginForm.classList.add('active');
        signupForm.classList.remove('active');
        clearMessage();
    });

    tabSignup.addEventListener('click', () => {
        tabSignup.classList.add('active');
        tabLogin.classList.remove('active');
        signupForm.classList.add('active');
        loginForm.classList.remove('active');
        clearMessage();
    });

    // --- 2. СМЕНА ЯЗЫКА (Локализация) ---
    langSwitcher.addEventListener('click', () => {
        currentLang = currentLang === 'RU' ? 'EN' : 'RU';
        langSwitcher.textContent = currentLang;

        // Находим все элементы с атрибутом data-text и меняем текст
        document.querySelectorAll('[data-text]').forEach(element => {
            const key = element.getAttribute('data-text');
            if (translations[currentLang][key]) {
                element.textContent = translations[currentLang][key];
            }
        });
    });

    // --- 3.ОТПРАВКА ФОРМЫ ВХОДА (LOGIN) ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearMessage();

        const identifier = document.getElementById('loginUser').value.trim();
        const password = document.getElementById('loginPassword').value;
        const remember = document.getElementById('rememberMe').checked;

        if (!identifier || !password) {
            showMessage(translations[currentLang].errorEmpty);
            return;
        }

        try {
            // Маршрут бэкэнда: /api/auth/login
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ identifier, password, remember }),
                // credentials: 'include' важен для того, чтобы браузер сохранял cookies (JWT- токен) от бэкэнда
                credentials: 'include' 
            });

            const data = await response.json();

            if (response.ok) {
                showMessage(translations[currentLang].successLogin, false);
                // Перенаправляем пользователя в профиль спустя 1.5 секунды
                setTimeout(() => {
                    window.location.href = '/';
                }, 1500);
            } else {
                showMessage(data.error || 'Ошибка авторизации');
            }
        } catch (error) {
            console.error('Login error:', error);
            showMessage('Сервер недоступен. Попробуйте позже.');
        }
    });

    // --- 4. ОТПРАВКА ФОРМЫ РЕГИСТРАЦИИ (SIGNUP) ---
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearMessage();

        const email = document.getElementById('signupEmail').value.trim();
        const login = document.getElementById('signupLogin').value.trim();
        const emoji = document.getElementById('signupEmoji').value.trim();
        const password = document.getElementById('signupPassword').value;

        if (!email || !login || !password) {
            showMessage(translations[currentLang].errorEmpty);
            return;
        }

        try {
            // Маршрут бэкэнда: /api/auth/signup
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, login, emoji, password }),
                credentials: 'include'
            });

            const data = await response.json();

            if (response.ok) {
                showMessage(translations[currentLang].successSignup, false);
                // Перенаправляем пользователя в профиль спустя 1.5 секунды
                setTimeout(() => {
                    window.location.href = '/';
                }, 1500);
            } else {
                showMessage(data.error || 'Ошибка регистрации');
            }
        } catch (error) {
            console.error('Signup error:', error);
            showMessage('Сервер недоступен. Попробуйте позже.');
        }
    });
});