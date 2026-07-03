package user

import (
	"github.com/gin-gonic/gin"
)

func RegisterRoutes(router *gin.RouterGroup, h *Handler) {
	router.GET("/profile", h.GetProfile)
	router.GET("/short_profile", h.GetShortProfile)
}
