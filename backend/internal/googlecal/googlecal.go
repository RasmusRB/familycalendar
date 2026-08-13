// Package googlecal wraps Google OAuth2 + Calendar API access for one partner's account.
package googlecal

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"golang.org/x/oauth2"
	googleoauth "golang.org/x/oauth2/google"
	"google.golang.org/api/calendar/v3"
	"google.golang.org/api/option"

	"familycalendar/backend/internal/config"
	"familycalendar/backend/internal/store"
)

var scopes = []string{
	"https://www.googleapis.com/auth/calendar.events",
	"https://www.googleapis.com/auth/calendar.readonly",
	"https://www.googleapis.com/auth/userinfo.email",
	"openid",
}

type Client struct {
	cfg config.Config
}

func New(cfg config.Config) *Client {
	return &Client{cfg: cfg}
}

func (c *Client) redirectURI() string {
	return strings.TrimRight(c.cfg.PublicAPIURL, "/") + "/api/accounts/google/callback"
}

func (c *Client) oauthConfig() *oauth2.Config {
	return &oauth2.Config{
		ClientID:     c.cfg.GoogleClientID,
		ClientSecret: c.cfg.GoogleClientSecret,
		RedirectURL:  c.redirectURI(),
		Scopes:       scopes,
		Endpoint:     googleoauth.Endpoint,
	}
}

func (c *Client) AuthURL(slot config.PartnerSlot) string {
	return c.oauthConfig().AuthCodeURL(
		string(slot),
		oauth2.AccessTypeOffline,
		oauth2.SetAuthURLParam("prompt", "consent"),
	)
}

type ExchangeResult struct {
	Token *oauth2.Token
	Email string
}

func (c *Client) ExchangeCode(ctx context.Context, code string) (*ExchangeResult, error) {
	cfg := c.oauthConfig()
	token, err := cfg.Exchange(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("exchange code: %w", err)
	}

	httpClient := cfg.Client(ctx, token)
	resp, err := httpClient.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		return nil, fmt.Errorf("fetch userinfo: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("userinfo request failed: %s", resp.Status)
	}

	var info struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, fmt.Errorf("decode userinfo: %w", err)
	}
	if info.Email == "" {
		info.Email = "unknown"
	}

	return &ExchangeResult{Token: token, Email: info.Email}, nil
}

// persistingTokenSource wraps an oauth2.TokenSource and writes refreshed
// access tokens back to SQLite so future requests reuse them.
type persistingTokenSource struct {
	mu    sync.Mutex
	slot  config.PartnerSlot
	store *store.Store
	base  oauth2.TokenSource
	last  string
}

func (p *persistingTokenSource) Token() (*oauth2.Token, error) {
	tok, err := p.base.Token()
	if err != nil {
		return nil, err
	}

	p.mu.Lock()
	changed := tok.AccessToken != p.last
	if changed {
		p.last = tok.AccessToken
	}
	p.mu.Unlock()

	if changed {
		_ = p.store.UpdateAccessToken(p.slot, tok.AccessToken, tok.Expiry.UnixMilli())
	}
	return tok, nil
}

// CalendarService builds a Calendar API client for the given connected account,
// automatically refreshing (and persisting) the access token as needed.
func (c *Client) CalendarService(ctx context.Context, st *store.Store, account *store.Account) (*calendar.Service, error) {
	initial := &oauth2.Token{
		AccessToken:  account.AccessToken.String,
		RefreshToken: account.RefreshToken.String,
	}
	if account.TokenExpiry.Valid {
		initial.Expiry = time.UnixMilli(account.TokenExpiry.Int64)
	}

	base := c.oauthConfig().TokenSource(ctx, initial)
	ts := &persistingTokenSource{slot: account.Slot, store: st, base: base, last: account.AccessToken.String}

	return calendar.NewService(ctx, option.WithTokenSource(ts))
}
