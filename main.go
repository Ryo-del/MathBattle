package main

import (
	"context"
	"errors"
	"log"
	"log/slog"
	"os"

	auth "mathbattle/auth"
	"mathbattle/chat"
	Pillars "mathbattle/game/Lava_Pillars"
	"mathbattle/middleware"
	"mathbattle/user"

	"github.com/gin-contrib/cors"

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

func Ping(c *gin.Context) {
	c.JSON(200, gin.H{
		"message": "pong",
	})
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

	log.Println("=== БАЗА ДАННЫХ ПОЛНОСТЬЮ СБРОШЕНА ===")
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
	userHandler := &user.Handler{
		DB: pool,
	}
	mw := &middleware.Middleware{
		JwtSecret: JWTkey,
	}
	chatHandler := &chat.Handler{
		DB: pool,
	}
	roomManager := Pillars.NewRoomManager()

	pillarsHandler := &Pillars.Handler{
		DB:      pool,
		Manager: roomManager,
	}
	router := gin.Default()
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"http://localhost:8080", "http://127.0.0.1:8080"} // Укажи порты, на которых запускаешь сайт
	config.AllowCredentials = true
	config.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}
	router.Use(cors.New(config))
	// Главная страница MathBattle
	router.StaticFile("/", "./web/index.html")
	router.StaticFile("/script.js", "./web/script.js")
	router.StaticFile("/style.css", "./web/style.css")

	// Страница авторизации (Вход / Регистрация)
	router.StaticFile("/login", "./web/auth/index.html")
	router.Static("/auth", "./web/auth") // Позволит загружать /auth/script.js и /auth/style.css

	router.Static("/login", "./web/login")
	router.Static("/profile-assets", "./web/profile")

	router.GET("/profile/:login", func(c *gin.Context) {
		c.File("./web/profile/index.html")
	})

	//Lava Pillars
	router.Static("/Lava_Pillars-assets", "./web/game/Lava_Pillars/")
	router.GET("/Lava_Pillars/:id", func(c *gin.Context) {
		c.File("./web/game/Lava_Pillars/index.html")
	})
	router.Static("/static", "./web/static")
	api := router.Group("/api")
	authGroup := api.Group("/auth")
	userGroup := api.Group("/user")
	chatGroup := api.Group("/chat")
	lavaPillarsGroup := api.Group("/lavaPillars")
	userGroup.Use(mw.AuthMiddleware())
	lavaPillarsGroup.Use(mw.AuthMiddleware())
	chatGroup.Use(mw.AuthMiddleware())
	hub := chat.NewHub()

	go hub.Run() // Запуск хаба в отдельной горутине

	chat.RegisterRoutes(chatGroup, hub, chatHandler)
	auth.RegisterRoutes(authGroup, authHandler)
	user.RegisterRoutes(userGroup, userHandler)
	Pillars.RegisterRouters(lavaPillarsGroup, pillarsHandler)
	slog.Info("Starting server on :8080")
	err = router.Run(":8080")
	if err != nil {
		slog.Error("Failed to start server", "err", err)
		return
	}

}
