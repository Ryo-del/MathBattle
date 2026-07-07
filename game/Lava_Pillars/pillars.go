package Pillars

type Game struct {
	Room  *Room
	Round int

	LavaHeight int

	Questions []Question
}

type Question struct {
	Text          string   // Сам вопрос
	Variants      []string // Массив вариантов ("Варианты")
	CorrectAnswer string   // Правильный ответ
}

func NewGame(room *Room) *Game {
	return &Game{
		Room:       room,
		Round:      1,
		LavaHeight: 0,
		Questions:  []Question{},
	}
}

//TODO: сделать затычку чтобы проверить fronted у room
