package Formula

import "mathbattle/repo"

type Game struct {
	Room *Room `json:"-"`

	Round int `json:"round"`

	Map [][]Tile `json:"-"`

	Objects []Object `json:"objects"`

	Players []GamePlayer `json:"players"`

	repo repo.Interface `json:"-"`
}
type Object struct {
	ID int `json:"id"`

	X int `json:"x"`
	Y int `json:"y"`

	HP int `json:"hp"`

	Destructible bool `json:"destructible"`
}
type GamePlayer struct {
	Player *Player `json:"player"`

	SequenceNumber int `json:"sequence_number"`

	Alive bool `json:"alive"`

	X int `json:"x"`
	Y int `json:"y"`

	HP int `json:"hp"`
}
type Projectile struct {
	X float64
	Y float64

	Formula string

	Owner int
}
type Tile struct {
	Solid bool `json:"solid"`
}

// formula.go (Частичное обновление)

func NewGame(room *Room, repository repo.Interface) *Game {
	g := &Game{
		Room:  room,
		Round: 1,
		repo:  repository,
		Map:   make([][]Tile, 20),
	}

	// Инициализируем карту 20x20
	for i := range g.Map {
		g.Map[i] = make([]Tile, 20)
	}

	// Спавним игроков из комнаты
	var seq int
	for _, p := range room.Players {
		g.Players = append(g.Players, GamePlayer{
			Player:         p,
			SequenceNumber: seq,
			Alive:          true,
			X:              2 + (seq * 4), // Начальный спавн по X
			Y:              10,            // Спавн по Y
			HP:             100,
		})
		seq++
	}

	g.GenerateObjects()

	return g
}

func (g *Game) GenerateObjects() {
	// Спавним несколько разрушаемых объектов (препятствий) на карте
	g.Objects = []Object{
		{ID: 1, X: 5, Y: 8, HP: 30, Destructible: true},
		{ID: 2, X: 10, Y: 12, HP: 30, Destructible: true},
		{ID: 3, X: 15, Y: 7, HP: 30, Destructible: true},
	}

	// Помечаем эти тайлы на карте как твердые
	for _, obj := range g.Objects {
		if obj.HP > 0 {
			g.Map[obj.X][obj.Y].Solid = true
		}
	}
}
