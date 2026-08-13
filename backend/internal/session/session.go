// Package session implements a minimal HMAC-signed cookie session,
// carrying a single "authenticated" flag with a server-checked expiry.
package session

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"time"
)

const CookieName = "fc.session"
const maxAge = 30 * 24 * time.Hour

type Manager struct {
	secret []byte
	secure bool
}

func NewManager(secret string, secure bool) *Manager {
	return &Manager{secret: []byte(secret), secure: secure}
}

type payload struct {
	Authenticated bool  `json:"authenticated"`
	Exp           int64 `json:"exp"`
}

func (m *Manager) sign(data []byte) string {
	mac := hmac.New(sha256.New, m.secret)
	mac.Write(data)
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func (m *Manager) SetAuthenticated(w http.ResponseWriter) {
	p := payload{Authenticated: true, Exp: time.Now().Add(maxAge).Unix()}
	body, _ := json.Marshal(p)
	encoded := base64.RawURLEncoding.EncodeToString(body)
	value := encoded + "." + m.sign(body)

	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    value,
		Path:     "/",
		MaxAge:   int(maxAge.Seconds()),
		HttpOnly: true,
		Secure:   m.secure,
		SameSite: http.SameSiteLaxMode,
	})
}

func (m *Manager) Clear(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   m.secure,
		SameSite: http.SameSiteLaxMode,
	})
}

// IsAuthenticated reports whether the request carries a validly signed,
// unexpired session cookie.
func (m *Manager) IsAuthenticated(r *http.Request) bool {
	cookie, err := r.Cookie(CookieName)
	if err != nil || cookie.Value == "" {
		return false
	}

	dot := -1
	for i := len(cookie.Value) - 1; i >= 0; i-- {
		if cookie.Value[i] == '.' {
			dot = i
			break
		}
	}
	if dot < 0 {
		return false
	}
	encoded, sig := cookie.Value[:dot], cookie.Value[dot+1:]

	body, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return false
	}
	expected := m.sign(body)
	if subtle.ConstantTimeCompare([]byte(sig), []byte(expected)) != 1 {
		return false
	}

	var p payload
	if err := json.Unmarshal(body, &p); err != nil {
		return false
	}
	if !p.Authenticated {
		return false
	}
	return time.Now().Unix() < p.Exp
}
