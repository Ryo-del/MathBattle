package chat

import "github.com/gin-gonic/gin"

func RegisterRoutes(router *gin.RouterGroup, hub *Hub, h *Handler) {
	router.GET("/ws", func(c *gin.Context) {
		HandlerWebSocket(c, hub, h)
	})
	router.GET("/history", func(c *gin.Context) {
		messages, err := h.repo.HandlerGetHistoryMessages()
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to get messages"})
			return
		}
		c.JSON(200, messages)
	})
}
