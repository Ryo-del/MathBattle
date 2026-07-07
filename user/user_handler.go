package user

import (
	"github.com/gin-gonic/gin"
)

func RegisterRoutes(router *gin.RouterGroup, h *Handler) {
	router.GET("/profile/:login", h.GetProfileByLogin)
	router.GET("/short_profile", h.GetShortProfile)
}
