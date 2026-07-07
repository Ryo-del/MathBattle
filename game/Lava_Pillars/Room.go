package Pillars

import (
	"crypto/rand"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Message struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

type Handler struct {
	DB      *pgxpool.Pool
	Manager *RoomManager
}
type RoomManager struct {
	mu    sync.RWMutex
	rooms map[string]*Room
}
type RoomUpdate struct {
	Type    string          `json:"type"`
	LobbyID string          `json:"lobby_id"`
	Players []PlayerPreview `json:"players"`
}
type PlayerPreview struct {
	Login string `json:"login"`
	Emoji string `json:"emoji"`
	Ready bool   `json:"ready"`
}

type Room struct {
	mu         sync.RWMutex
	Players    map[int]*Player
	State      RoomState
	LobbyID    string
	MaxPlayers int
}

type Player struct {
	UserID int
	Login  string
	Emoji  string

	Conn *websocket.Conn

	IsReady bool
}

type RoomState int

const (
	Waiting RoomState = iota
	Starting
	Playing
	Finished
)

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
const Code_Lenght = 4

var ErrUnauthorized = errors.New("no user in context")

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func (h *Handler) CurrentPlayer(c *gin.Context, conn *websocket.Conn) (*Player, error) {
	userIDAny, exists := c.Get("user_id")
	if !exists {
		return nil, ErrUnauthorized
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
		return nil, err
	}
	Player := &Player{
		UserID: int(userID),
		Login:  login,
		Emoji:  emoji,

		Conn:    conn,
		IsReady: false,
	}
	return Player, nil
}
func GenerateLobbyID(length int) (string, error) {
	b := make([]byte, length)

	random := make([]byte, length)
	if _, err := rand.Read(random); err != nil {
		return "", err
	}

	for i := range b {
		b[i] = letters[int(random[i])%len(letters)]
	}

	return string(b), nil
}
func (m *RoomManager) GenerateUniqueLobbyID() (string, error) {
	for {
		id, err := GenerateLobbyID(Code_Lenght)
		if err != nil {
			return "", err
		}

		m.mu.RLock()
		_, exists := m.rooms[id]
		m.mu.RUnlock()

		if !exists {
			return id, nil
		}
	}
}

func NewRoomManager() *RoomManager {
	return &RoomManager{
		rooms: make(map[string]*Room),
	}
}

func (m *RoomManager) CreateRoom(lobbyID string) *Room {
	room := &Room{
		LobbyID: lobbyID,
		State:   Waiting,

		MaxPlayers: 4,
		Players:    make(map[int]*Player),
	}

	m.mu.Lock()
	m.rooms[lobbyID] = room
	m.mu.Unlock()

	return room
}

func (h *Handler) CreateLobby(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		slog.Error("Failed to set websocket upgrade", "err", err)
		return
	}
	defer conn.Close()
	lobbyID, err := h.Manager.GenerateUniqueLobbyID()
	if err != nil {
		slog.Error("Failed to Generate the Lobby Code", "error", err)
		return
	}

	room := h.Manager.CreateRoom(lobbyID)

	Player, err := h.CurrentPlayer(c, conn)
	if err != nil {
		if err == ErrUnauthorized {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "no user in context",
			})
			return
		} else {
			slog.Error("db error", "err", err)

			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "internal server error",
			})
			return
		}

	}

	room.AddPlayer(Player)
	err = conn.WriteJSON(gin.H{
		"type":     "room_created",
		"lobby_id": lobbyID,
	})
	if err != nil {
		return
	}
	for {
		var msg Message
		if err := conn.ReadJSON(&msg); err != nil {
			room.DeletePlayer(Player)
			room.Broadcast(room.Snapshot())
			break
		}
		h.HandleMessage(room, Player, msg)

	}
}

func (r *Room) AddPlayer(player *Player) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Players[player.UserID] = player

}

func (r *Room) DeletePlayer(player *Player) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.Players, player.UserID)
}

func (m *RoomManager) GetRoom(lobbyID string) (*Room, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	room, ok := m.rooms[lobbyID]
	return room, ok
}
func (r *Room) IsFull() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	return len(r.Players) >= r.MaxPlayers
}
func (h *Handler) JoinRoom(c *gin.Context) {
	lobbyID := c.Param("id")
	if lobbyID == "" {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "empty lobbyID",
		})
		return
	}

	room, ok := h.Manager.GetRoom(lobbyID)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Room not found",
		})
		return
	}
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		slog.Error("Failed to set websocket upgrade", "err", err)
		return
	}
	defer conn.Close()

	Player, err := h.CurrentPlayer(c, conn)
	if err != nil {
		if err == ErrUnauthorized {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "no user in context",
			})
			return
		} else {
			slog.Error("db error", "err", err)

			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "internal server error",
			})
			return
		}

	}

	if room.IsFull() {
		c.JSON(http.StatusConflict, gin.H{
			"error": "room is full",
		})
		return
	}
	room.AddPlayer(Player)
	room.Broadcast(room.Snapshot())
	for {
		var msg Message
		if err := conn.ReadJSON(&msg); err != nil {
			room.DeletePlayer(Player)
			room.Broadcast(room.Snapshot())
			break
		}
		h.HandleMessage(room, Player, msg)

	}
}
func (m *RoomManager) GetRandomRoom() (*Room, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, room := range m.rooms {
		if !room.IsFull() {
			return room, true
		}
	}

	return nil, false
}
func (h *Handler) JoinRandomRoom(c *gin.Context) {
	room, exists := h.Manager.GetRandomRoom()
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"code":    "NO_FREE_ROOMS",
			"message": "No available spots in any rooms. Please create a new one.",
		})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		slog.Error("Failed to set websocket upgrade", "err", err)
		return
	}
	defer conn.Close()

	Player, err := h.CurrentPlayer(c, conn)
	if err != nil {
		if err == ErrUnauthorized {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "no user in context",
			})
			return
		} else {
			slog.Error("db error", "err", err)

			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "internal server error",
			})
			return
		}

	}
	room.AddPlayer(Player)
	room.Broadcast(room.Snapshot())
	for {
		var msg Message
		if err := conn.ReadJSON(&msg); err != nil {
			room.DeletePlayer(Player)
			room.Broadcast(room.Snapshot())
			break
		}
		h.HandleMessage(room, Player, msg)

	}
}

func (r *Room) Snapshot() RoomUpdate {
	r.mu.RLock()
	defer r.mu.RUnlock()

	players := make([]PlayerPreview, 0, len(r.Players))
	for _, player := range r.Players {
		players = append(players, PlayerPreview{
			Login: player.Login,
			Emoji: player.Emoji,
			Ready: player.IsReady,
		})
	}

	return RoomUpdate{
		Type:    "room_update",
		LobbyID: r.LobbyID,
		Players: players,
	}
}
func (r *Room) Broadcast(v any) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, player := range r.Players {
		err := player.Conn.WriteJSON(v)
		if err != nil {
			slog.Error(
				"failed to send message",
				"user_id", player.UserID,
				"err", err,
			)
		}
	}
}
func (h *Handler) HandleMessage(room *Room, player *Player, msg Message) {
	switch msg.Type {

	case "ready":
		player.IsReady = true
		room.Broadcast(room.Snapshot())

	case "unready":
		player.IsReady = false
		room.Broadcast(room.Snapshot())
	case "leave":
		room.DeletePlayer(player)
		room.Broadcast(room.Snapshot())
	case "start":
		for _, p := range room.Players {
			if !p.IsReady {
				_ = player.Conn.WriteJSON(gin.H{
					"type":    "error",
					"message": "not all players are ready",
				})
				return
			}
			room.State = Playing

			NewGame(room) // пока просто создаем

			room.Broadcast(gin.H{
				"type": "game_started",
			})

		}

	}
}
