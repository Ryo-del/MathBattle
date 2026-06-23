package auth

import (
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type SignUpRequest struct { //регистрация
	Email    string `json:"email"`
	Login    string `json:"login"`
	Emoji    string `json:"emoji"`
	Password string `json:"password"`
}

type LogInRequest struct { //вход
	Login    string `json:"login"`
	Password string `json:"password"`
}

type Handler struct {
	DB        *pgxpool.Pool
	JwtSecret string
}

type Claims struct {
	UserID int64 `json:"user_id"`
	jwt.RegisteredClaims
}

func (h *Handler) SignUpHandler(c *gin.Context) {
	var req SignUpRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "invalid json"})
		return
	}

	hash, err := h.Hash(req.Password)
	if err != nil {
		slog.Error("bcrypt error", "err", err)
		c.JSON(500, gin.H{"error": "internal error"})
		return
	}

	_, err = h.DB.Exec(
		c.Request.Context(),
		`INSERT INTO users (email, login, emoji, password_hash, created_at)
		VALUES ($1, $2, $3, $4, $5)`,
		req.Email,
		req.Login,
		req.Emoji,
		hash,
		time.Now(),
	)

	if err != nil {
		slog.Error("db insert error", "err", err, "email", req.Email)
		c.JSON(500, gin.H{"error": "internal error"})
		return
	}

	c.JSON(201, gin.H{
		"message": "user created",
	})
}

func (h *Handler) LogInHandler(c *gin.Context) {
	var req LogInRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "invalid json"})
		return
	}
	var (
		userID       int64
		passwordHash string
	)

	err := h.DB.QueryRow(
		c.Request.Context(),
		`SELECT id, password_hash
		FROM users
		WHERE login = $1`,
		req.Login,
	).Scan(&userID, &passwordHash)

	if err != nil {
		slog.Error("failed to find user", "err", err)

		c.JSON(401, gin.H{
			"error": "invalid credentials",
		})

		return
	}
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

	//JWT
	token, err := h.GenerateJWT(userID)
	if err != nil {
		slog.Error("failed to generate jwt", "err", err)

		c.JSON(500, gin.H{
			"error": "internal server error",
		})

		return
	}

	c.JSON(200, gin.H{
		"token": token,
	})
}

func (h *Handler) Hash(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword(
		[]byte(password),
		bcrypt.DefaultCost,
	)
	if err != nil {
		return "", err
	}

	return string(hash), nil
}

func (h *Handler) GenerateJWT(userID int64) (string, error) {
	claims := Claims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	return token.SignedString(h.JwtSecret)
}
