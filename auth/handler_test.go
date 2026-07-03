package auth

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

func TestHash(t *testing.T) {
	password := "12345"
	hash, err := Hash(password)
	if err != nil {
		t.Fatal(err)
	}

	err = bcrypt.CompareHashAndPassword(
		[]byte(hash),
		[]byte(password),
	)
	if err != nil {
		t.Fatal(err)
	}
}
func TestGenerateJWT(t *testing.T) {
	h := &Handler{
		JwtSecret: "secret",
	}
	token, err := h.GenerateJWT(123, true)
	if err != nil {
		t.Fatal(err)
	}
	if token == "" {
		t.Fatal("token is empty")
	}
	parsedToken, err := jwt.ParseWithClaims(
		token,
		&Claims{},
		func(t *jwt.Token) (any, error) {
			return []byte(h.JwtSecret), nil
		},
	)
	if err != nil {
		t.Fatal(err)
	}
	claims, ok := parsedToken.Claims.(*Claims)
	if !ok {
		t.Fatal("cannot parse claims")
	}
	if claims.UserID != 123 {
		t.Fatalf(
			"got %d want %d",
			claims.UserID,
			123,
		)
	}
}
func TestSingInvalidJson(t *testing.T) {
	gin.SetMode(gin.TestMode)

	body := `{
		"email":"example@gmail.com",
		"login":
	}`

	w := httptest.NewRecorder()

	c, _ := gin.CreateTestContext(w)

	req := httptest.NewRequest(
		http.MethodPost,
		"/singup",
		strings.NewReader(body),
	)

	req.Header.Set("Content-Type", "application/json")

	c.Request = req

	h := &Handler{}

	h.SignUpHandler(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf(
			"got %d want %d",
			w.Code,
			http.StatusBadRequest,
		)
	}
}
