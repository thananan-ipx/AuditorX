package repository

import (
	"context"
	"strings"
	"testing"
)

func TestPasswordHashUsesUniqueSaltAndRejectsWrongPasswords(t *testing.T) {
	ctx := context.Background()
	password := "ทดสอบรหัสผ่าน-Local99!"
	first, err := hashPassword(ctx, password)
	if err != nil {
		t.Fatal(err)
	}
	second, err := hashPassword(ctx, password)
	if err != nil {
		t.Fatal(err)
	}
	if first == second || strings.Contains(first, password) {
		t.Fatal("password hashes expose text or reuse salt")
	}
	if !checkPassword(ctx, first, password) || checkPassword(ctx, first, "wrong-password") {
		t.Fatal("password verification failed")
	}
	for _, malformed := range []string{"", "$argon2id$v=19$m=999999999,t=999,p=8$abc$def", passwordPrefix + "bad$encoding"} {
		if checkPassword(ctx, malformed, password) {
			t.Fatal("malformed hash accepted")
		}
	}
	if _, err := normalizedCredentials("Test@Example.Local", strings.Repeat("x", 129)); err == nil {
		t.Fatal("unbounded password accepted")
	}
	if _, err := normalizedCredentials("Name <test@example.local>", password); err == nil {
		t.Fatal("display-name email accepted")
	}
}
