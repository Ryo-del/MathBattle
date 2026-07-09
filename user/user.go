package user

import (
	"log/slog"
	repo "mathbattle/repo"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	repo repo.Repository
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

func NewHandler(repo *repo.Repository) *Handler {
	return &Handler{
		repo: *repo,
	}
}
func (h *Handler) GetProfileByLogin(c *gin.Context) {
	login := c.Param("login")
	profile, err := h.repo.GetFullProfile(login)
	if err != nil {
		slog.Error("db error", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
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

	login, emoji, err := h.repo.GetShortProfile(userID)
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
