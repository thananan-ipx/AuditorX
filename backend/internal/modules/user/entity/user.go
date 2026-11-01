package entity

type User struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

type Session struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	User        User   `json:"user"`
}
