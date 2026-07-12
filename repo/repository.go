package repo

import (
	"context"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Interface interface {
	AddResultToProfilePillars(userID int64, win bool) error
	AddResultToProfileFormula(userID int64, win bool) error
	GetShortProfile(userID int64) (string, string, error)
	GetFullProfile(login string) (*Profile, error)
	SaveHistoryMessage(userID int64, emoji string, login string, text string) error
	HandlerGetHistoryMessages() ([]ChatMessage, error)
	SignUpUser(Email string, Login string, Emoji string, hash string) (int64, error)
	LogInUser(Identifier string) (int64, string, error)
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{
		DB: db,
	}
}

func (r *Repository) LogInUser(Identifier string) (int64, string, error) {
	var (
		userID       int64
		passwordHash string
	)
	err := r.DB.QueryRow(
		context.Background(),
		`
        SELECT id, password_hash
        FROM users
        WHERE login = $1
        OR email = $1
    `,
		Identifier,
	).Scan(&userID, &passwordHash)
	if err != nil {
		return userID, passwordHash, err
	}
	return userID, passwordHash, nil
}
func (r *Repository) SignUpUser(Email string, Login string, Emoji string, hash string) (int64, error) {
	var userID int64

	// Используем QueryRow и RETURNING id, чтобы получить сгенерированный базой ID нового пользователя
	err := r.DB.QueryRow(
		context.Background(),
		`INSERT INTO users (email, login, emoji, password_hash, created_at)
        VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		Email,
		Login,
		Emoji,
		hash,
		time.Now(),
	).Scan(&userID)
	if err != nil {
		return userID, err
	}
	return userID, nil
}
func (r *Repository) SaveHistoryMessage(userID int64, emoji string, login string, text string) error {
	_, err := r.DB.Exec(context.Background(), "INSERT INTO messages (user_id, emoji, login, text) VALUES ($1, $2, $3, $4)", userID, emoji, login, text)
	if err != nil {
		return err
	}

	return nil
}
func (r *Repository) HandlerGetHistoryMessages() ([]ChatMessage, error) {
	rows, err := r.DB.Query(context.Background(), "SELECT user_id, emoji, login, text FROM messages ORDER BY id DESC LIMIT 50")
	if err != nil {
		slog.Error("Failed to get messages from database", "err", err)
		return nil, err
	}
	defer rows.Close()

	var messages []ChatMessage
	for rows.Next() {
		var message ChatMessage
		err := rows.Scan(&message.UserID, &message.Emoji, &message.Login, &message.Text)
		if err != nil {
			slog.Error("Failed to scan message", "err", err)
			return nil, err
		}
		messages = append(messages, message)
	}
	return messages, nil
}
func (r *Repository) GetFullProfile(login string) (*Profile, error) {
	var profile Profile
	err := r.DB.QueryRow(context.Background(),
		`SELECT login, emoji, email, lava_pillars_games, lava_pillars_wins, formula_wars_games, formula_wars_wins, created_at FROM users WHERE login = $1`,
		login).Scan(&profile.Login, &profile.Emoji, &profile.Email, &profile.LavaPillarsGames, &profile.LavaPillarsWins, &profile.FormulaWarsGames, &profile.FormulaWarsWins, &profile.CreatedAt)
	if err != nil {
		return &profile, err
	}
	return &profile, nil
}
func (r *Repository) GetShortProfile(userID int64) (string, string, error) {
	var login, emoji string

	err := r.DB.QueryRow(
		context.Background(),
		`
		SELECT login, emoji
		FROM users
		WHERE id = $1
		`,
		userID,
	).Scan(&login, &emoji)
	if err != nil {
		return "", "", err
	}
	return login, emoji, nil
}

func (r *Repository) AddResultToProfilePillars(userID int64, win bool) error {
	query := `
		UPDATE users
		SET lava_pillars_games = lava_pillars_games + 1
		WHERE id = $1
	`

	if win {
		query = `
			UPDATE users
			SET
				lava_pillars_games = lava_pillars_games + 1,
				lava_pillars_wins  = lava_pillars_wins + 1
			WHERE id = $1
		`
	}

	_, err := r.DB.Exec(context.Background(), query, userID)

	return err
}
func (r *Repository) AddResultToProfileFormula(userID int64, win bool) error {
	query := `
		UPDATE users
		SET formula_wars_games = formula_wars_games + 1
		WHERE id = $1
	`

	if win {
		query = `
			UPDATE users
			SET
				formula_wars_games = formula_wars_games + 1,
				formula_wars_wins  = formula_wars_wins + 1
			WHERE id = $1
		`
	}

	_, err := r.DB.Exec(context.Background(), query, userID)
	return err
}
