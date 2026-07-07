package Pillars

import "github.com/gin-gonic/gin"

func RegisterRouters(router *gin.RouterGroup, h *Handler) {
	router.GET("/create", h.CreateLobby)
	router.GET("/join/:id", h.JoinRoom)
	router.GET("/quick", h.JoinRandomRoom)

}
