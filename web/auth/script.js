document.addEventListener("DOMContentLoaded", () => {

    console.log("SCRIPT LOADED");

    const dictionary = {
        ru: {
            loginTab: "Вход",
            signupTab: "Регистрация",
            loginPlaceholder: "Email или логин",
            passwordPlaceholder: "Пароль",
            usernamePlaceholder: "Логин",
            emojiPlaceholder: "Выбери статус-эмодзи (😎, 🚀)",
            rememberMe: "Не выходить из аккаунта",
            loginBtn: "Войти",
            signupBtn: "Создать аккаунт",
            errEmpty: "Пожалуйста, заполните все обязательные поля.",
            errPasswordShort: "Пароль должен быть не менее 6 символов.",
            errFetch: "Ошибка соединения с сервером.",
            successLogin: "Успешный вход!",
            successSignup: "Регистрация успешна!"
        },
        en: {
            loginTab: "Sign In",
            signupTab: "Sign Up",
            loginPlaceholder: "Email or username",
            passwordPlaceholder: "Password",
            usernamePlaceholder: "Username",
            emojiPlaceholder: "Choose status emoji (😎, 🚀)",
            rememberMe: "Keep me signed in",
            loginBtn: "Sign In",
            signupBtn: "Create Account",
            errEmpty: "Please fill in all required fields.",
            errPasswordShort: "Password must be at least 6 characters.",
            errFetch: "Server connection error.",
            successLogin: "Successfully logged in!",
            successSignup: "Registration successful!"
        }
    };

    let currentLang = 'ru';
    const BASE_URL = '/api';

    const langSwitcher = document.getElementById('langSwitcher');
    const tabLogin = document.getElementById('tabLogin');
    const tabSignup = document.getElementById('tabSignup');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const msgBox = document.getElementById('msgBox');

    function showMsg(text, type = 'error') {
        msgBox.textContent = text;
        msgBox.className = 'msg-box';

        setTimeout(() => {
            msgBox.classList.add('show', type);
        }, 10);
    }

    function hideMsg() {
        msgBox.className = 'msg-box';
    }

    // 🌍 LANG SWITCH
    langSwitcher.addEventListener('click', () => {
        currentLang = currentLang === 'ru' ? 'en' : 'ru';
        langSwitcher.textContent = currentLang.toUpperCase();

        document.querySelectorAll('[data-text]').forEach(el => {
            const key = el.getAttribute('data-text');
            if (dictionary[currentLang][key]) {
                el.textContent = dictionary[currentLang][key];
            }
        });

        hideMsg();
    });

    // 🔄 TABS
    tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabSignup.classList.remove('active');
        loginForm.classList.add('active');
        signupForm.classList.remove('active');
        hideMsg();
    });

    tabSignup.addEventListener('click', () => {
        tabSignup.classList.add('active');
        tabLogin.classList.remove('active');
        signupForm.classList.add('active');
        loginForm.classList.remove('active');
        hideMsg();
    });

    // 🔐 LOGIN
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const loginValue = document.getElementById('loginUser').value.trim();
        const pass = document.getElementById('loginPassword').value.trim();
        const remember = document.getElementById('rememberMe').checked;

        if (!loginValue || !pass) {
            showMsg(dictionary[currentLang].errEmpty, 'error');
            return;
        }

        try {
            const response = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    identifier: loginValue,
                    password: pass,
                    remember
                })
            });

            const text = await response.text();
            let data = {};

            try {
                data = text ? JSON.parse(text) : {};
            } catch {
                console.error("LOGIN invalid JSON:", text);
            }

            if (response.ok) {
                showMsg(dictionary[currentLang].successLogin, 'success');
                setTimeout(() => window.location.href = '/', 800);
            } else {
                showMsg(data.error || data.message || 'Error', 'error');
            }

        } catch (err) {
            console.error(err);
            showMsg(dictionary[currentLang].errFetch, 'error');
        }
    });

    // 🆕 SIGNUP
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        console.log("SIGNUP FIRED");

        const email = document.getElementById('signupEmail').value.trim();
        const login = document.getElementById('signupLogin').value.trim();
        const emoji = document.getElementById('signupEmoji').value.trim();
        const pass = document.getElementById('signupPassword').value.trim();

        if (!email || !login || !pass) {
            showMsg(dictionary[currentLang].errEmpty, 'error');
            return;
        }

        if (pass.length < 6) {
            showMsg(dictionary[currentLang].errPasswordShort, 'error');
            return;
        }

        try {
            const response = await fetch(`${BASE_URL}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    email,
                    login,
                    emoji: emoji || "👤",
                    password: pass
                })
            });

            console.log("STATUS:", response.status);

            const text = await response.text();
            let data = {};

            try {
                data = text ? JSON.parse(text) : {};
            } catch {
                console.error("SIGNUP invalid JSON:", text);
            }

            if (response.ok) {
                showMsg(dictionary[currentLang].successSignup, 'success');
                setTimeout(() => window.location.href = '/', 1000);
            } else {
                showMsg(data.error || data.message || 'Error', 'error');
            }

        } catch (err) {
            console.error(err);
            showMsg(dictionary[currentLang].errFetch, 'error');
        }
    });

});