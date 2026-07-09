package chat

import (
	"log/slog"
	"mathbattle/repo"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

type Handler struct {
	repo repo.Repository
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func NewHandler(repo *repo.Repository) *Handler {
	return &Handler{
		repo: *repo,
	}
}
func (h *Handler) SaveHistoryMessage(message Message) error {
	err := h.repo.SaveHistoryMessage(message.UserID, message.Emoji, message.Login, message.Text)
	if err != nil {
		slog.Error("Failed to save message to database", "err", err)
		return err
	}
	return nil
}

func HandlerWebSocket(c *gin.Context, hub *Hub, h *Handler) {

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		slog.Error("Failed to set websocket upgrade", "err", err)
		return
	}
	defer conn.Close()
	userIDAny, exist := c.Get("user_id")
	if !exist {
		slog.Error("User ID not found in context")
		return
	}
	userID := userIDAny.(int64)
	login, emoji, err := h.repo.GetShortProfile(userID)
	if err != nil {
		slog.Error("Failed to get user info", "err", err)
		return
	}

	client := &Client{
		Conn:  conn,
		ID:    userID,
		Login: login,
		Emoji: emoji,
	}

	hub.register <- client
	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			hub.unregister <- client
			slog.Error("Error reading message", "err", err)
			break
		}
		message := Message{
			UserID: client.ID,
			Login:  client.Login,
			Emoji:  client.Emoji,
			Text:   string(msg),
		}

		hub.broadcast <- message
		h.SaveHistoryMessage(message)
	}

}
