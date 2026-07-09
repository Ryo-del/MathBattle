package auth

import (
	"errors"
	"log/slog"
	"mathbattle/repo"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"
)

// SignUpRequest описывает структуру тела запроса для регистрации
type SignUpRequest struct {
	Email    string `json:"email"`
	Login    string `json:"login"`
	Emoji    string `json:"emoji"`
	Password string `json:"password"`
}

// LogInRequest описывает структуру тела запроса для входа
type LogInRequest struct {
	Identifier string `json:"identifier"`
	Password   string `json:"password"`
	Remember   bool   `json:"remember"`
}

// Handler инкапсулирует зависимости для работы с авторизацией
type Handler struct {
	repo      repo.Repository
	JwtSecret string
}

// Claims описывает структуру полезной нагрузки (payload) JWT-токена
type Claims struct {
	UserID int64 `json:"user_id"`
	jwt.RegisteredClaims
}

func NewHandler(repo *repo.Repository, JWT string) *Handler {
	return &Handler{
		repo:      *repo,
		JwtSecret: JWT,
	}
}

// SignUpHandler регистрирует нового пользователя и сразу авторизует его (ставит JWT-куку)
func (h *Handler) SignUpHandler(c *gin.Context) {
	var req SignUpRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "bad request"})
		return
	}

	hash, err := Hash(req.Password)
	if err != nil {
		slog.Error("failed to hash password", "err", err)
		c.JSON(500, gin.H{"error": "internal server error"})
		return
	}
	if req.Emoji == "" {
		req.Emoji = "🤓"
	}
	var userID int64
	userID, err = h.repo.SignUpUser(req.Email, req.Login, req.Emoji, hash)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			// Код 23505 означает нарушение уникальности (Unique Violation) для Email или Login
			if pgErr.Code == "23505" {
				c.JSON(409, gin.H{"error": "login or email already exists"})
				return
			}
		}
		slog.Error("db insert error", "err", err)
		c.JSON(500, gin.H{"error": "internal server error"})
		return
	}

	// Автоматически генерируем JWT для только что созданного пользователя
	token, err := h.GenerateJWT(userID, false)
	if err != nil {
		slog.Error("failed to generate jwt after signup", "err", err)
		c.JSON(500, gin.H{"error": "internal server error"})
		return
	}

	// Время жизни сессии после регистрации по умолчанию — 2 часа (7200 секунд)
	maxAge := 2 * 60 * 60

	// Устанавливаем куку со значением JWT-токена
	c.SetCookie(
		"token", // имя куки
		token,   // значение (сам JWT)
		maxAge,  // время жизни в секундах
		"/",     // путь (доступна на всем сайте)
		"",      // домен (пусто для localhost)
		false,   // secure: false для локальной разработки без HTTPS
		true,    // httpOnly: true защищает токен от кражи через XSS/JS-скрипты
	)

	c.JSON(201, gin.H{
		"message": "user created and logged in",
	})
}

// LogInHandler проверяет данные пользователя и создает сессию (ставит JWT-куку)
func (h *Handler) LogInHandler(c *gin.Context) {
	var req LogInRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "invalid json"})
		return
	}

	userID, passwordHash, err := h.repo.LogInUser(req.Identifier)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(401, gin.H{
			"error": "invalid credentials",
		})
		return
	}

	if err != nil {
		slog.Error("database error", "err", err)
		c.JSON(500, gin.H{
			"error": "internal server error",
		})
		return
	}

	// Сверяем введенный пароль с хешем из базы данных
	err = bcrypt.CompareHashAndPassword(
		[]byte(passwordHash),
		[]byte(req.Password),
	)
	if err != nil {
		c.JSON(401, gin.H{
			"error": "invalid credentials",
		})
		return
	}

	// Генерируем JWT-токена с учетом флага "Запомнить меня"
	token, err := h.GenerateJWT(userID, req.Remember)
	if err != nil {
		slog.Error("failed to generate jwt", "err", err)
		c.JSON(500, gin.H{"error": "internal server error"})
		return
	}

	// Настраиваем время жизни куки
	maxAge := 2 * 60 * 60 // 2 часа
	if req.Remember {
		maxAge = 7 * 24 * 60 * 60 // 7 дней
	}

	// Устанавливаем куку
	c.SetCookie(
		"token",
		token,
		maxAge,
		"/",
		"",
		false, // secure
		true,  // httpOnly
	)

	c.JSON(200, gin.H{
		"message": "successfully logged in",
	})
}

// Hash хеширует сырой пароль с помощью bcrypt
func Hash(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword(
		[]byte(password),
		bcrypt.DefaultCost,
	)
	if err != nil {
		return "", err
	}

	return string(hash), nil
}

// GenerateJWT генерирует и подписывает JWT-токен секретным ключом
func (h *Handler) GenerateJWT(userID int64, remember bool) (string, error) {
	var exp time.Duration

	if remember {
		exp = 7 * 24 * time.Hour // 7 дней сессии
	} else {
		exp = 2 * time.Hour // 2 часа сессии
	}

	claims := Claims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(exp)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	return token.SignedString([]byte(h.JwtSecret))
}
func (h *Handler) LogoutHandler(c *gin.Context) {
	c.SetCookie(
		"token",
		"",
		-1, // 👈 удаление cookie
		"/",
		"",
		false,
		true,
	)

	c.JSON(200, gin.H{"message": "logged out"})
}
