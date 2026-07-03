package main

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestPing(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	Ping(c)
	expected := `{"message":"pong"}`

	if strings.TrimSpace(w.Body.String()) != expected {
		t.Fatalf("got %s want %s", w.Body.String(), expected)
	}
	if w.Code != 200 {
		t.Fatalf("got %d want 200", w.Code)
	}
}
