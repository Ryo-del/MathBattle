package Pillars

import (
	"cmp"
	"encoding/json"
	"errors"
	"log/slog"
	"math"
	"math/rand"
	"mathbattle/repo"
	"os"
	"slices"
)

type Game struct {
	Room  *Room
	Round int
	repo  repo.Interface

	LavaHeight float64

	AllQuestion     []Question
	CurrentQuestion Question
	Players         []*GamePlayer
}

type GamePlayer struct {
	Player *Player
	Alive  bool

	Height float64

	Answered bool
	Answer   int
	TimeMs   int
}

type Question struct {
	Text          string   `json:"text"`
	Variants      []string `json:"variants"`
	CorrectAnswer int      `json:"correct_answer"`
}

const NoAnswer = -1

func NewGame(room *Room, repo repo.Interface, pack int) *Game {
	questions, err := LoadQuestions(pack)
	if err != nil {
		slog.Error("Error with load question", "error", err)
		return nil
	}
	game := &Game{
		Room:        room,
		repo:        repo,
		AllQuestion: questions,
		Round:       0,
		LavaHeight:  1,
	}
	for _, p := range room.Players {
		game.Players = append(game.Players, &GamePlayer{
			Player: p,
			Alive:  true,
			Height: 3,
		})
	}
	game.NewRound()

	return game
}

func (g *Game) NewRound() {
	question, err := GenerateQuestion(g.AllQuestion)
	if err != nil {
		slog.Error("Error with generate question", "error", err)
		return
	}
	g.Round++
	g.CurrentQuestion = question

	g.Room.Broadcast(NewRoundMessage{
		Type:  "new_round",
		Round: g.Round,
		Question: ClientQuestion{
			Text:     question.Text,
			Variants: question.Variants,
		},
	})

}
func LoadQuestions(pack int) ([]Question, error) {
	var dir string
	if pack == 1 {
		dir = "game/Lava_Pillars/Questions/Math.json"
	} else {
		dir = "game/Lava_Pillars/Questions/Everything.json"
	}
	data, err := os.ReadFile(dir)
	if err != nil {
		slog.Error("Error with open file question.json", "error", err)
		return nil, err
	}
	var question []Question
	err = json.Unmarshal(data, &question)
	if err != nil {
		slog.Error("Error with Unmarshal file", "error", err)
		return nil, err
	}
	return question, nil
}
func GenerateQuestion(questions []Question) (Question, error) {
	if len(questions) == 0 {
		return Question{}, errors.New("no questions")
	}

	question := questions[rand.Intn(len(questions))]

	return question, nil

}
func (g *Game) CalculateResult() {
	var correctPlayers []*GamePlayer
	for _, gp := range g.Players {
		if gp.Answer == g.CurrentQuestion.CorrectAnswer {
			correctPlayers = append(correctPlayers, gp)
		}
	}
	slices.SortFunc(correctPlayers, func(a, b *GamePlayer) int {
		return cmp.Compare(a.TimeMs, b.TimeMs)
	})

	for i, gp := range correctPlayers {
		gain := g.IncreaseTheHeight(i, len(correctPlayers), g.Round)
		gp.Height += gain
	}
	g.IncreaseTheLava(g.Round)
	aliveCount := 0
	players := make([]PlayerRoundResult, 0, len(g.Players))
	var best *GamePlayer
	for _, p := range g.Players {
		p.Answered = false
		p.Answer = NoAnswer
		p.TimeMs = 0
		if p.Alive && p.Height <= g.LavaHeight {
			p.Alive = false
			g.IsLose(p)
			continue
		}
		if !p.Alive {
			continue
		}

		aliveCount++
		if best == nil || p.Height > best.Height {
			best = p
		}
		players = append(players, PlayerRoundResult{
			UserID: p.Player.UserID,
			Login:  p.Player.Login,
			Emoji:  p.Player.Emoji,
			Alive:  p.Alive,
			Height: p.Height,
		})
	}
	g.Room.Broadcast(RoundResultMessage{
		Type:           "round_result",
		Correct_answer: g.CurrentQuestion.CorrectAnswer,
		Round:          g.Round,
		LavaHeight:     g.LavaHeight,
		Players:        players,
	})
	if aliveCount == 0 {
		best := g.HighestPlayer()
		g.IsWin(best)
		g.End()
		return
	}
	if aliveCount == 1 {
		g.IsWin(best)
		g.End()
		return
	}

	g.NewRound()
}
func (g *Game) HighestPlayer() *GamePlayer {
	var best *GamePlayer

	for _, p := range g.Players {
		if best == nil || p.Height > best.Height {
			best = p
		}
	}

	return best
}
func (g *Game) FindPlayer(player *Player) *GamePlayer {
	for _, gp := range g.Players {
		if gp.Player == player {
			return gp
		}
	}
	return nil
}
func (g *Game) IncreaseTheLava(round int) {
	progress := math.Min(float64(round)/30.0, 1.0)
	g.LavaHeight += 0.9 + progress*0.8
}
func (g *Game) IncreaseTheHeight(place int, length int, round int) float64 {
	// После 30 раунда бонус уже не растет

	progress := math.Min(float64(round)/30.0, 1.0)
	gain := 1.0
	place++
	if length == 1 {
		return gain + math.Pow(progress, 2)*1.5
	}
	// 1 место = 1.0
	// 2 место = 0.66
	// 3 место = 0.33
	// 4 место = 0

	speedFactor := float64(length-place) / float64(length-1)
	// Максимальный бонус за скорость = +1.5
	speedBonus := speedFactor * math.Pow(progress, 2) * 1.5

	gain += speedBonus
	return gain

}
func (g *Game) HasEveryoneAnswered() bool {
	for _, p := range g.Players {
		if p.Answered != true {
			return false
		}
	}
	return true
}
func (g *Game) IsWin(gp *GamePlayer) {
	_ = g.repo.AddResultToProfilePillars(int64(gp.Player.UserID), true)
	gp.Player.Conn.WriteJSON(WinMessage{
		Type:    "win",
		Message: "you win!",
	})

}
func (g *Game) IsLose(gp *GamePlayer) {
	_ = g.repo.AddResultToProfilePillars(int64(gp.Player.UserID), false)
	gp.Player.Conn.WriteJSON(LoseMessage{
		Type:    "lose",
		Message: "you lose!",
	})
}
func (g *Game) End() {
	g.Room.State = Finished

	g.Room.Broadcast(GameFinishedMessage{
		Type: "game_finished",
	})
}
func IsPlayerAlive(room *Room, player *Player) *GamePlayer {
	gp := room.Game.FindPlayer(player)
	if !gp.Alive {
		player.Conn.WriteJSON(ErrorMessage{
			Type:    "error",
			Message: "you died",
		})
		return nil
	}
	return gp
}
