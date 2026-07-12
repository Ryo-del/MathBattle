package Formula

import (
	"crypto/rand"
	"encoding/json"
	"log/slog"
	"math"
	"math/big"

	"github.com/Knetic/govaluate"
	"github.com/gin-gonic/gin"
)

type ActionMessage struct {
	Action  string `json:"action"` // "shoot" или "preview"
	Formula string `json:"formula,omitempty"`
}

// Структура для передачи фронтенду истории полета стрелы ради красивой анимации
type ProjectilePathPoint struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}
type GameState struct {
	Players []GamePlayer `json:"players"`
	Objects []Object     `json:"objects"`
	Round   int          `json:"round"`
}
type TurnResultEvent struct {
	Type         string                `json:"type"`
	ActivePlayer int64                 `json:"active_player_id"`
	NextPlayer   int64                 `json:"next_player_id"`
	Formula      string                `json:"formula"`
	Path         []ProjectilePathPoint `json:"path"`
	HitTarget    string                `json:"hit_target"` // "player", "object", "wall", "none"
	HitPlayerID  int64                 `json:"hit_player_id,omitempty"`
	NewPlayerX   int                   `json:"new_player_x,omitempty"`
	NewPlayerY   int                   `json:"new_player_y,omitempty"`
	TargetState  GameState             `json:"target_state"`
}

func (g *Game) ToDTO() GameState {

	return GameState{
		Players: g.Players,
		Objects: g.Objects,
		Round:   g.Round,
	}

}

// Запуск игры (пошаговый режим инициализации)
func (g *Game) StartLoop() {

	if len(g.Players) == 0 {
		return
	}

	g.Round = 0

	g.Room.Broadcast(gin.H{
		"type":             "turn_started",
		"active_player_id": g.Players[g.Round].Player.UserID,
		"state":            g.ToDTO(),
	})
}

// Генерация случайной свободной позиции на карте 20х20 для телепортации
func (g *Game) GetRandomFreeLocation() (int, int) {
	for {
		nX, _ := rand.Int(rand.Reader, big.NewInt(20))
		nY, _ := rand.Int(rand.Reader, big.NewInt(20))
		x := int(nX.Int64())
		y := int(nY.Int64())

		// Проверяем, не твердый ли тайл
		if g.Map[x][y].Solid {
			continue
		}
		// Проверяем, нет ли там объектов
		objHit := false
		for _, obj := range g.Objects {
			if obj.X == x && obj.Y == y && obj.HP > 0 {
				objHit = true
				break
			}
		}
		if objHit {
			continue
		}
		return x, y
	}
}

func (g *Game) HandleGameAction(userID int64, data json.RawMessage) {
	var action ActionMessage
	if err := json.Unmarshal(data, &action); err != nil {
		slog.Error("Failed to parse game action", "err", err)
		return
	}

	// Проверяем, существует ли текущий игрок и живой ли он
	if g.Round < 0 || g.Round >= len(g.Players) {
		return
	}
	currentPlayer := &g.Players[g.Round]

	// Проверка: коварный игрок пытается походить не в свою очередь
	if currentPlayer.Player.UserID != userID || !currentPlayer.Alive {
		return
	}

	switch action.Action {
	case "preview":
		// Игрок пишет формулу, фронтенд просит "полупрозрачную тень" траектории
		path := g.CalculateTrajectory(float64(currentPlayer.X), float64(currentPlayer.Y), action.Formula)

		// Отправляем траекторию ТОЛЬКО автору запроса для отображения тени
		_ = currentPlayer.Player.Conn.WriteJSON(gin.H{
			"type":    "trajectory_preview",
			"formula": action.Formula,
			"path":    path,
		})

	case "shoot":
		// Рассчитываем реальный полет стрелы
		path := g.CalculateTrajectory(float64(currentPlayer.X), float64(currentPlayer.Y), action.Formula)

		event := TurnResultEvent{
			Type:         "turn_result",
			ActivePlayer: currentPlayer.Player.UserID,
			Formula:      action.Formula,
			Path:         path,
			HitTarget:    "none",
		}

		// Обрабатываем столкновения по точкам траектории
		g.ProcessTrajectoryCollisions(path, &event)

		// Проверяем окончание игры
		if g.CheckGameOver() {
			g.Room.State = Finished
			g.Room.Broadcast(gin.H{
				"type":         "game_over",
				"target_state": g.ToDTO(),
			})
			return
		}

		// Передаем ход следующему ЖИВОМУ игроку
		oldRound := g.Round
		for {
			g.Round = (g.Round + 1) % len(g.Players)
			if g.Players[g.Round].Alive || g.Round == oldRound {
				break
			}
		}

		event.NextPlayer = g.Players[g.Round].Player.UserID
		event.TargetState = g.ToDTO()

		g.Room.Broadcast(event)

		g.Room.Broadcast(gin.H{
			"type":             "turn_started",
			"active_player_id": g.Players[g.Round].Player.UserID,
			"state":            g.ToDTO(),
		})
	}
}

// Математический расчет точек траектории f(x)
// Математический расчет точек траектории f(x) в стиле Graphwar
func (g *Game) CalculateTrajectory(startX, startY float64, formulaStr string) []ProjectilePathPoint {
	var path []ProjectilePathPoint
	expression, err := govaluate.NewEvaluableExpression(formulaStr)
	if err != nil {
		return path // Если формула невалидна, стоим на месте
	}

	parameters := make(map[string]interface{})

	// Шаг делаем меньше (0.05), чтобы траектория была плавной и точной
	for step := 0.0; step <= 20.0; step += 0.05 {
		parameters["x"] = step
		result, err := expression.Evaluate(parameters)
		if err != nil {
			break
		}

		if val, ok := result.(float64); ok {
			currentX := startX + step
			// ИНВЕРСИЯ Y: в математике +val идет ВВЕРХ, поэтому вычитаем из startY
			currentY := startY - val

			// Если снаряд полностью вылетел за пределы сетки 20х20 — уничтожаем
			if currentX < 0 || currentX >= 20 || currentY < 0 || currentY >= 20 {
				break
			}

			path = append(path, ProjectilePathPoint{X: currentX, Y: currentY})
		} else {
			break
		}
	}
	return path
}

// Проход по координатам траектории и применение игровой логики Worms
func (g *Game) ProcessTrajectoryCollisions(path []ProjectilePathPoint, event *TurnResultEvent) {
	for _, point := range path {
		gridX := int(math.Round(point.X))
		gridY := int(math.Round(point.Y))

		// Границы массива карты на всякий случай
		if gridX < 0 || gridX >= 20 || gridY < 0 || gridY >= 20 {
			event.HitTarget = "wall"
			return
		}

		// 1. Попадание в препятствия (разрушаемый ландшафт)
		for i := range g.Objects {
			obj := &g.Objects[i]
			if obj.HP > 0 && obj.X == gridX && obj.Y == gridY {
				if obj.Destructible {
					obj.HP -= 10 // Наносим урон стене/объекту
					if obj.HP <= 0 {
						obj.HP = 0
						g.Map[obj.X][obj.Y].Solid = false // Объект уничтожен, клетка пуста
					}
				}
				event.HitTarget = "object"
				return // Стрела разрушилась об объект
			}
		}

		// 2. Попадание в игроков (Наносит 1/4 урона (25 HP) и телепортирует)
		for i := range g.Players {
			target := &g.Players[i]
			// Нельзя попасть в уже мертвого, но можно попасть в самого себя, если закрутить формулу!
			if !target.Alive {
				continue
			}

			if target.X == gridX && target.Y == gridY {
				target.HP -= 25 // Урон 1/4 от 100
				event.HitTarget = "player"
				event.HitPlayerID = target.Player.UserID

				if target.HP <= 0 {
					target.HP = 0
					target.Alive = false
					_ = g.repo.AddResultToProfileFormula(int64(target.Player.UserID), false)
				} else {
					// Если выжил — телепортируем в случайное место
					randX, randY := g.GetRandomFreeLocation()
					target.X = randX
					target.Y = randY
					event.NewPlayerX = randX
					event.NewPlayerY = randY
				}
				return // Стрела уничтожена при попадании
			}
		}
	}
}

func (g *Game) CheckGameOver() bool {
	aliveCount := 0
	var winner *GamePlayer
	for i := range g.Players {
		if g.Players[i].Alive {
			aliveCount++
			winner = &g.Players[i]
		}
	}

	if aliveCount <= 1 && len(g.Players) > 1 {
		if winner != nil {
			_ = g.repo.AddResultToProfileFormula(int64(winner.Player.UserID), true)
		}
		return true
	}
	return false
}
