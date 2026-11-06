// Package github implements AuditorX's read-only GitHub App integration.
package github

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	ClientID      string
	ClientSecret  string
	CallbackURL   string
	AppSlug       string
	EncryptionKey []byte
}

func (c Config) Enabled() bool { return c.ClientID != "" }

func LoadConfig() (Config, error) {
	c := Config{ClientID: strings.TrimSpace(os.Getenv("GITHUB_CLIENT_ID")), ClientSecret: strings.TrimSpace(os.Getenv("GITHUB_CLIENT_SECRET")), CallbackURL: strings.TrimSpace(os.Getenv("GITHUB_CALLBACK_URL")), AppSlug: strings.TrimSpace(os.Getenv("GITHUB_APP_SLUG"))}
	key := strings.TrimSpace(os.Getenv("GITHUB_TOKEN_ENCRYPTION_KEY"))
	if c.ClientID == "" && c.ClientSecret == "" && c.CallbackURL == "" && c.AppSlug == "" && key == "" {
		return c, nil
	}
	var err error
	c.EncryptionKey, err = base64.StdEncoding.DecodeString(key)
	if err != nil || len(c.EncryptionKey) != 32 {
		return Config{}, errors.New("GITHUB_TOKEN_ENCRYPTION_KEY must be base64 encoding of 32 random bytes")
	}
	u, err := url.Parse(c.CallbackURL)
	if err != nil || u.User != nil || u.RawQuery != "" || u.Fragment != "" || u.Path != "/api/v1/auth/github/callback" || (u.Scheme != "https" && !(u.Scheme == "http" && (u.Hostname() == "localhost" || u.Hostname() == "127.0.0.1"))) || u.Host == "" {
		return Config{}, errors.New("GITHUB_CALLBACK_URL must be an HTTPS callback URL (HTTP allowed only on loopback)")
	}
	if c.ClientID == "" || c.ClientSecret == "" || !regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,99}$`).MatchString(c.AppSlug) {
		return Config{}, errors.New("configure GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET and GITHUB_APP_SLUG together")
	}
	return c, nil
}

func Seal(key []byte, token string, githubID int64) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err = rand.Read(nonce); err != nil {
		return nil, err
	}
	return gcm.Seal(nonce, nonce, []byte(token), []byte(strconv.FormatInt(githubID, 10))), nil
}
func Open(key, encrypted []byte, githubID int64) (string, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(encrypted) < gcm.NonceSize() {
		return "", errors.New("invalid encrypted credential")
	}
	token, err := gcm.Open(nil, encrypted[:gcm.NonceSize()], encrypted[gcm.NonceSize():], []byte(strconv.FormatInt(githubID, 10)))
	return string(token), err
}

var ErrAccess = errors.New("GitHub access expired or unavailable; reconnect GitHub and check repository permissions")

type Client struct{ HTTP *http.Client }

func NewClient() *Client {
	tr := http.DefaultTransport.(*http.Transport).Clone()
	tr.Proxy = nil
	return &Client{HTTP: &http.Client{Transport: tr, Timeout: 20 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}}
}

// Never includes response bodies, request URLs or tokens in returned errors.
func (c *Client) request(ctx context.Context, method, address, token string, body []byte) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, method, address, bytes.NewReader(body))
	if err != nil {
		return nil, ErrAccess
	}
	req.Header.Set("User-Agent", "AuditorX")
	req.Header.Set("Accept", "application/vnd.github+json")
	if address == "https://github.com/login/oauth/access_token" {
		req.Header.Set("Accept", "application/json")
	}
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, ErrAccess
	}
	return resp, nil
}
func decode(resp *http.Response, out any) error {
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return ErrAccess
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, (4<<20)+1))
	if err != nil || len(data) > 4<<20 {
		return ErrAccess
	}
	if json.Unmarshal(data, out) != nil {
		return ErrAccess
	}
	return nil
}
func (c *Client) Get(ctx context.Context, token, path string, out any) error {
	resp, err := c.request(ctx, http.MethodGet, "https://api.github.com"+path, token, nil)
	if err != nil {
		return err
	}
	return decode(resp, out)
}

type AccessToken struct {
	Token     string `json:"access_token"`
	ExpiresIn int    `json:"expires_in"`
}

func (c *Client) Exchange(ctx context.Context, cfg Config, code, verifier string) (AccessToken, error) {
	payload, _ := json.Marshal(map[string]string{"client_id": cfg.ClientID, "client_secret": cfg.ClientSecret, "code": code, "redirect_uri": cfg.CallbackURL, "code_verifier": verifier})
	resp, err := c.request(ctx, http.MethodPost, "https://github.com/login/oauth/access_token", "", payload)
	if err != nil {
		return AccessToken{}, err
	}
	var token AccessToken
	if err = decode(resp, &token); err != nil || token.Token == "" || len(token.Token) > 1024 || token.ExpiresIn < 0 {
		return AccessToken{}, ErrAccess
	}
	return token, nil
}

type Profile struct {
	ID    int64  `json:"id"`
	Login string `json:"login"`
}
type Email struct {
	Email    string `json:"email"`
	Verified bool   `json:"verified"`
	Primary  bool   `json:"primary"`
}
type Installation struct {
	ID      int64 `json:"id"`
	Account struct {
		Login string `json:"login"`
	} `json:"account"`
}
type Repository struct {
	ID            int64  `json:"id"`
	Name          string `json:"name"`
	FullName      string `json:"full_name"`
	Private       bool   `json:"private"`
	DefaultBranch string `json:"default_branch"`
	Owner         struct {
		Login string `json:"login"`
	} `json:"owner"`
}

func (r Repository) Path() (string, error) {
	if r.ID <= 0 || !regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$`).MatchString(r.Owner.Login) || !regexp.MustCompile(`^[a-zA-Z0-9_.-]{1,100}$`).MatchString(r.Name) || r.Name == "." || r.Name == ".." {
		return "", ErrAccess
	}
	return "/repos/" + r.Owner.Login + "/" + r.Name, nil
}
func (c *Client) Repository(ctx context.Context, token string, id int64) (Repository, error) {
	var repo Repository
	err := c.Get(ctx, token, "/repositories/"+strconv.FormatInt(id, 10), &repo)
	if err != nil || repo.ID != id {
		return Repository{}, ErrAccess
	}
	if _, err = repo.Path(); err != nil {
		return Repository{}, err
	}
	return repo, nil
}

// Archive follows only GitHub's single archive redirect, and never forwards the
// bearer token to the download host. Signed download URLs never leave this call.
func (c *Client) Archive(ctx context.Context, token, repoPath, sha string, limit int64) ([]byte, error) {
	resp, err := c.request(ctx, http.MethodGet, "https://api.github.com"+repoPath+"/zipball/"+sha, token, nil)
	if err != nil {
		return nil, err
	}
	location := resp.Header.Get("Location")
	resp.Body.Close()
	u, err := url.Parse(location)
	if resp.StatusCode != 302 || err != nil || u.Scheme != "https" || u.Host != "codeload.github.com" || u.User != nil || u.Fragment != "" {
		return nil, ErrAccess
	}
	resp, err = c.request(ctx, http.MethodGet, u.String(), "", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, ErrAccess
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, limit+1))
	if err != nil || int64(len(data)) > limit {
		return nil, fmt.Errorf("GitHub archive unavailable or exceeds size limit")
	}
	return data, nil
}
