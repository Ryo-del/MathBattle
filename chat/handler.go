package chat

import "github.com/gin-gonic/gin"

func RegisterRoutes(router *gin.RouterGroup, hub *Hub, h *Handler) {
	router.GET("/ws", func(c *gin.Context) {
		HandlerWebSocket(c, hub, h)
	})
}
