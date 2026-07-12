package Formula

import "encoding/json"

type GameStartedMessage struct {
	Type string `json:"type"`
}

type ErrorMessage struct {
	Type    string `json:"type"`
	Message string `json:"message"`
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

type Message struct {
	Formula string
	Type    string          `json:"type"`
	Data    json.RawMessage `json:"data"`
}
