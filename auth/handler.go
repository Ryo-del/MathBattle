package auth

import "github.com/gin-gonic/gin"

func RegisterRoutes(router *gin.RouterGroup, h *Handler) {
	router.POST("/signup", h.SignUpHandler)
	router.POST("/login", h.LogInHandler)
	router.POST("/logout", h.LogoutHandler)
}
