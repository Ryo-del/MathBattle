package chat

import (
	"context"
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

func SaveHistoryMessage(db *pgxpool.Pool, message Message) error {
	_, err := db.Exec(context.Background(), "INSERT INTO messages (user_id, emoji, login, text) VALUES ($1, $2, $3, $4)", message.UserID, message.Emoji, message.Login, message.Text)
	if err != nil {
		slog.Error("Failed to save message to database", "err", err)
		return err
	}
	return nil
}

func HandlerGetHistoryMessages(db *pgxpool.Pool) ([]Message, error) {
	rows, err := db.Query(context.Background(), "SELECT user_id, emoji, login, text FROM messages ORDER BY id DESC LIMIT 50")
	if err != nil {
		slog.Error("Failed to get messages from database", "err", err)
		return nil, err
	}
	defer rows.Close()

	var messages []Message
	for rows.Next() {
		var message Message
		err := rows.Scan(&message.UserID, &message.Emoji, &message.Login, &message.Text)
		if err != nil {
			slog.Error("Failed to scan message", "err", err)
			return nil, err
		}
		messages = append(messages, message)
	}
	return messages, nil
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
		SaveHistoryMessage(h.DB, message)
	}

}
