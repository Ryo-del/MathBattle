package repo

import (
	"time"

	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	DB *pgxpool.Pool
}
type Profile struct {
	Login string `json:"login"`
	Emoji string `json:"emoji"`
	Email string `json:"email"`

	LavaPillarsGames int64 `json:"lava_pillars_games"`
	LavaPillarsWins  int64 `json:"lava_pillars_wins"`

	FormulaWarsGames int64 `json:"formula_wars_games"`
	FormulaWarsWins  int64 `json:"formula_wars_wins"`

	CreatedAt time.Time `json:"created_at"`
}
type GamePlayer struct {
	Player *Player
	Alive  bool

	Height float64

	Answered bool
	Answer   int
	TimeMs   int
}
type Player struct {
	UserID int
	Login  string
	Emoji  string

	Conn *websocket.Conn

	IsReady bool
}
type ChatMessage struct {
	UserID int64  `json:"user_id"`
	Emoji  string `json:"emoji"`
	Login  string `json:"login"`
	Text   string `json:"text"`
}
