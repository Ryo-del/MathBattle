package Formula

import (
	"crypto/rand"
	"errors"
	"log/slog"
	"mathbattle/repo"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

type Handler struct {
	repo    *repo.Repository
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
	Players    map[int64]*Player
	State      RoomState
	LobbyID    string
	MaxPlayers int
	Game       *Game
}

type Player struct {
	UserID int64  `json:"user_id"`
	Login  string `json:"login"`
	Emoji  string `json:"emoji"`

	Conn    *websocket.Conn `json:"-"`
	IsReady bool            `json:"ready"`
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

func NewHandler(repo *repo.Repository, manager *RoomManager) *Handler {
	return &Handler{
		repo:    repo, // Передаем указатель напрямую
		Manager: manager,
	}
}
func (h *Handler) CurrentPlayer(c *gin.Context, conn *websocket.Conn) (*Player, error) {
	userIDAny, exists := c.Get("user_id")
	if !exists {
		return nil, ErrUnauthorized
	}

	userID := userIDAny.(int64)

	login, emoji, err := h.repo.GetShortProfile(userID)
	if err != nil {
		return nil, err
	}
	Player := &Player{
		UserID: userID,
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
		Players:    make(map[int64]*Player),
	}

	m.mu.Lock()
	m.rooms[lobbyID] = room
	m.mu.Unlock()

	return room
}

// На примере метода CreateLobby в Room.go:

func (h *Handler) CreateLobby(c *gin.Context) {

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	player, err := h.CurrentPlayer(c, conn)
	if err != nil {
		conn.Close()
		return
	}

	lobbyID, err := h.Manager.GenerateUniqueLobbyID()
	if err != nil {
		conn.Close()
		return
	}

	room := h.Manager.CreateRoom(lobbyID)

	room.AddPlayer(player)

	player.Conn.WriteJSON(gin.H{
		"type":     "room_created",
		"lobby_id": lobbyID,
	})

	room.Broadcast(room.Snapshot())

	h.ReadLoop(room, player)
}

func (r *Room) AddPlayer(player *Player) {
	r.mu.Lock()
	r.Players[player.UserID] = player
	r.mu.Unlock()

	r.Broadcast(r.Snapshot())
}

func (r *Room) DeletePlayer(player *Player) {
	r.mu.Lock()
	delete(r.Players, player.UserID)
	r.mu.Unlock()

	r.Broadcast(r.Snapshot())
}
func (h *Handler) ReadLoop(room *Room, player *Player) {
	defer func() {
		room.DeletePlayer(player)
		room.Broadcast(room.Snapshot())
		player.Conn.Close()
	}()

	for {
		var msg Message

		if err := player.Conn.ReadJSON(&msg); err != nil {
			slog.Info("player disconnected",
				"user_id", player.UserID,
				"err", err,
			)
			return
		}

		h.HandleMessage(room, player, msg)
	}
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

	room, ok := h.Manager.GetRoom(lobbyID)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "room not found",
		})
		return
	}

	if room.IsFull() {
		c.JSON(http.StatusConflict, gin.H{
			"error": "room is full",
		})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	player, err := h.CurrentPlayer(c, conn)
	if err != nil {
		conn.Close()
		return
	}

	room.AddPlayer(player)

	room.Broadcast(room.Snapshot())

	h.ReadLoop(room, player)
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

	room, ok := h.Manager.GetRandomRoom()
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "no free rooms",
		})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	player, err := h.CurrentPlayer(c, conn)
	if err != nil {
		conn.Close()
		return
	}

	room.AddPlayer(player)

	room.Broadcast(room.Snapshot())

	h.ReadLoop(room, player)
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

	players := make([]*Player, 0, len(r.Players))
	for _, p := range r.Players {
		players = append(players, p)
	}

	r.mu.RUnlock()

	for _, p := range players {
		if err := p.Conn.WriteJSON(v); err != nil {
			slog.Error(
				"broadcast failed",
				"user_id", p.UserID,
				"err", err,
			)
		}
	}
}
func (h *Handler) HandleMessage(room *Room, player *Player, msg Message) {
	room.mu.RLock()
	gameRunning := room.State == Playing && room.Game != nil
	room.mu.RUnlock()

	if gameRunning && msg.Type == "game_action" {
		room.Game.HandleGameAction(player.UserID, msg.Data)
		return
	}

	switch msg.Type {

	case "ready":
		room.mu.Lock()
		player.IsReady = true
		room.mu.Unlock()

		room.Broadcast(room.Snapshot())

	case "unready":
		room.mu.Lock()
		player.IsReady = false
		room.mu.Unlock()

		room.Broadcast(room.Snapshot())

	case "leave":
		room.DeletePlayer(player)
		room.Broadcast(room.Snapshot())

	case "start":
		room.mu.RLock()
		for _, p := range room.Players {
			if !p.IsReady {
				room.mu.RUnlock()

				_ = player.Conn.WriteJSON(ErrorMessage{
					Type:    "error",
					Message: "not all players are ready",
				})
				return
			}
		}
		room.mu.RUnlock()

		room.mu.Lock()
		room.State = Playing
		room.Game = NewGame(room, h.repo)
		room.mu.Unlock()

		room.Broadcast(GameStartedMessage{
			Type: "game_started",
		})

		room.Game.StartLoop()
	}
}
