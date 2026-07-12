package Pillars

import "encoding/json"

type GameStartedMessage struct {
	Type string `json:"type"`
}
type Message struct {
	Answer int
	Type   string          `json:"type"`
	Pack   int             `json:"pack"`
	Data   json.RawMessage `json:"data"`
}
type NewRoundMessage struct {
	Type     string         `json:"type"`
	Round    int            `json:"round"`
	Question ClientQuestion `json:"question"`
}

type ClientQuestion struct {
	Text     string   `json:"text"`
	Variants []string `json:"variants"`
}

type RoundResultMessage struct {
	Type           string              `json:"type"`
	Round          int                 `json:"round"`
	Correct_answer int                 `json:"Correct_answer"`
	LavaHeight     float64             `json:"lava_height"`
	Players        []PlayerRoundResult `json:"players"`
}

type PlayerRoundResult struct {
	UserID int     `json:"user_id"`
	Login  string  `json:"login"`
	Emoji  string  `json:"emoji"`
	Alive  bool    `json:"alive"`
	Height float64 `json:"height"`
}
type GameFinishedMessage struct {
	Type string `json:"type"`
}
type WinMessage struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

type LoseMessage struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

type ErrorMessage struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}
