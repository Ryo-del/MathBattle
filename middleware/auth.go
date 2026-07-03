package middleware

import (
	"errors"
	"log/slog"
	"mathbattle/auth"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type Middleware struct {
	JwtSecret string
}

func (m *Middleware) AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {

		tokenStr, err := c.Cookie("token")
		if err != nil {
			c.AbortWithStatusJSON(401, gin.H{
				"error": "no token",
			})
			return
		}

		claims, err := m.ParseJWT(tokenStr)
		if err != nil {
			slog.Error("JWT parse failed", "err", err)
			c.AbortWithStatusJSON(401, gin.H{
				"error": "invalid token",
			})
			return
		}

		c.Set("user_id", claims.UserID)
		c.Next()
	}
}

func (m *Middleware) ParseJWT(tokenStr string) (*auth.Claims, error) {
	token, err := jwt.ParseWithClaims(
		tokenStr,
		&auth.Claims{},
		func(t *jwt.Token) (any, error) {
			return []byte(m.JwtSecret), nil
		},
	)

	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*auth.Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}
