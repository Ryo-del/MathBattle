package main

import (
	"context"
	"errors"
	"log/slog"
	"os"

	auth "mathbattle/auth"

	"github.com/gin-gonic/gin"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

type Server struct {
	DB *pgxpool.Pool
}

func initDatabase(dsn string) (*pgxpool.Pool, error) {
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		slog.Error("Error creating pool", "err", err)
		return nil, err
	}

	err = pool.Ping(ctx)
	if err != nil {
		slog.Error("Error pinging database", "err", err)
		return nil, err
	}
	slog.Info("Successfully connected to the database!")

	m, err := migrate.New("file://migrations", dsn)
	if err != nil {
		slog.Error("Error creating migration", "err", err)
		return nil, err
	}

	err = m.Up()
	if err != nil {
		if errors.Is(err, migrate.ErrNoChange) {
			slog.Info("База данных в актуальном состоянии (нет новых миграций)")
		} else {
			slog.Error("Не удалось применить миграции", "err", err)
			return nil, err
		}
	} else {
		slog.Info("Миграции успешно применены!")
	}
	slog.Info("Migrations ran successfully!")

	return pool, nil
}

func main() {
	err := godotenv.Load()
	if err != nil {
		slog.Error("Error loading .env file", "err", err)
		return
	}
	JWTkey := os.Getenv("JWT")
	if JWTkey == "" {
		slog.Error("JWT environment variable is not set")
		return
	}
	//init PostgreSQL
	DB_URL := os.Getenv("DB_DSN")
	if DB_URL == "" {
		slog.Error("DB_DSN environment variable is not set")
		return
	}
	pool, err := initDatabase(DB_URL)
	if err != nil {
		slog.Error("Failed to initialize database", "err", err)
		return
	}
	defer pool.Close()

	authHandler := &auth.Handler{
		DB:        pool,
		JwtSecret: JWTkey,
	}
	/*mw := &middleware.Middleware{
		JwtSecret: JWTkey,
	}
	*/
	router := gin.Default()

	authGroup := router.Group("/auth")
	auth.RegisterRoutes(authGroup, authHandler)

	slog.Info("Starting server on :8080")
	err = router.Run(":8080")
	if err != nil {
		slog.Error("Failed to start server", "err", err)
		return
	}

}
