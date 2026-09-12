package fixture

import (
	"crypto/tls"
	"encoding/json"
	"log"
	"os"
)

func unsafe(value any) {
	apiKey := "production-secret-value"
	log.Printf("credential: %s", apiKey)
	_ = tls.Config{InsecureSkipVerify: true}
	json.NewEncoder(os.Stdout).Encode(value)
}

func safe(value any) error {
	apiKey := os.Getenv("API_KEY")
	log.Print("request completed")
	if err := json.NewEncoder(os.Stdout).Encode(value); err != nil {
		return err
	}
	_ = apiKey
	return nil
}
