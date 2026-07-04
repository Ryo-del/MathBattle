package chat

import (
	"log/slog"

	"github.com/gorilla/websocket"
)

type Client struct {
	Conn *websocket.Conn

	ID    int64
	Login string
	Emoji string
}

type Message struct {
	UserID int64  `json:"user_id"`
	Emoji  string `json:"emoji"`
	Login  string `json:"login"`
	Text   string `json:"text"`
}

type Hub struct {
	clients map[*Client]struct{}

	register   chan *Client
	unregister chan *Client

	broadcast chan Message
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]struct{}),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan Message),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = struct{}{}
			slog.Info("client registered")
		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				slog.Info("client unregistered")
			}
			client.Conn.Close()
		case message := <-h.broadcast:
			for client := range h.clients {
				err := client.Conn.WriteJSON(message)
				slog.Info("message sent to client", "message", message)
				if err != nil {
					slog.Error("failed to write message", "error", err)
					delete(h.clients, client)
					client.Conn.Close()
				}
			}
		}
	}
}
