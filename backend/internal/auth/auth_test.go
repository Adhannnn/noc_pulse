package auth

import (
	"testing"

	"pulsenoc/backend/internal/models"
)

func TestAuthService_PasswordAndJWT(t *testing.T) {
	svc := NewAuthService("test-secret-key-1234567890")

	// 1. Password Hashing
	plainPassword := "secretPassword123"
	hashed, err := svc.HashPassword(plainPassword)
	if err != nil {
		t.Fatalf("Failed to hash password: %v", err)
	}

	if !svc.CheckPassword(hashed, plainPassword) {
		t.Fatalf("Expected password check to succeed")
	}

	if svc.CheckPassword(hashed, "wrongPassword") {
		t.Fatalf("Expected password check to fail for incorrect password")
	}

	// 2. JWT Generation & Validation
	user := &models.User{
		ID:    "usr-test",
		Email: "admin@test.com",
		Role:  models.RoleAdmin,
	}

	token, err := svc.GenerateToken(user)
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}

	claims, err := svc.ValidateToken(token)
	if err != nil {
		t.Fatalf("Failed to validate token: %v", err)
	}

	if claims.UserID != user.ID || claims.Email != user.Email || claims.Role != user.Role {
		t.Fatalf("Claims mismatch: got %+v", claims)
	}
}
