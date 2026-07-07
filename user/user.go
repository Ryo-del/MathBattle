package user

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	DB *pgxpool.Pool
}

type Profile struct {
	Login            string    `json:"login"`
	Emoji            string    `json:"emoji"`
	Email            string    `json:"email"`
	LavaPillarsGames int64     `json:"lava_pillars_games"`
	LavaPillarsWins  int64     `json:"lava_pillars_wins"`
	FormulaWarsGames int64     `json:"formula_wars_games"`
	FormulaWarsWins  int64     `json:"formula_wars_wins"`
	CreatedAt        time.Time `json:"created_at"`
}

func (h *Handler) GetProfileByLogin(c *gin.Context) {
	login := c.Param("login")

	var profile Profile
	err := h.DB.QueryRow(
		c.Request.Context(),
		`
		SELECT login, emoji, email, lava_pillars_games, lava_pillars_wins, formula_wars_games, formula_wars_wins, created_at
		FROM users
		WHERE login = $1
		`,
		login,
	).Scan(&profile.Login, &profile.Emoji, &profile.Email, &profile.LavaPillarsGames, &profile.LavaPillarsWins, &profile.FormulaWarsGames, &profile.FormulaWarsWins, &profile.CreatedAt)

	if err != nil {
		slog.Error("db error", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "internal server error",
		})
		return
	}

	c.JSON(http.StatusOK, profile)
}

func (h *Handler) GetShortProfile(c *gin.Context) {
	userIDAny, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "no user in context",
		})
		return
	}

	userID := userIDAny.(int64)

	var login, emoji string

	err := h.DB.QueryRow(
		c.Request.Context(),
		`
		SELECT login, emoji
		FROM users
		WHERE id = $1
		`,
		userID,
	).Scan(&login, &emoji)

	if err != nil {
		slog.Error("db error", "err", err)

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "internal server error",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"login": login,
		"emoji": emoji,
	})
}
