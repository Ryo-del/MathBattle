package chat

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	DB *pgxpool.Pool
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func HandlerWebSocket(c *gin.Context, hub *Hub, h *Handler) {

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		slog.Error("Failed to set websocket upgrade", "err", err)
		return
	}
	defer conn.Close()
	userID, exist := c.Get("user_id")
	if !exist {
		slog.Error("User ID not found in context")
		return
	}
	var login, emoji string
	err = h.DB.QueryRow(c, "SELECT login, emoji FROM users WHERE id = $1", userID).Scan(&login, &emoji)
	if err != nil {
		slog.Error("Failed to get user info", "err", err)
		return
	}

	client := &Client{
		Conn:  conn,
		ID:    userID.(int64),
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
	}

}
