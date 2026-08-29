package entity

type User struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

type Session struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	User         User   `json:"user"`
}
