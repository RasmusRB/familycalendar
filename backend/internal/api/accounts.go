package api

import (
	"net/http"
	"strings"

	"familycalendar/backend/internal/config"
	"familycalendar/backend/internal/store"
)

type accountView struct {
	Slot      string  `json:"slot"`
	Name      string  `json:"name"`
	Color     string  `json:"color"`
	Connected bool    `json:"connected"`
	Email     *string `json:"email"`
}

func (s *Server) toAccountView(slot config.PartnerSlot, a *store.Account) accountView {
	info := s.cfg.Partner(slot)
	v := accountView{Slot: string(slot), Name: info.Name, Color: info.Color}
	if a != nil {
		v.Connected = a.RefreshToken.Valid && a.RefreshToken.String != ""
		if a.Email.Valid {
			email := a.Email.String
			v.Email = &email
		}
	}
	return v
}

func (s *Server) handleListAccounts(w http.ResponseWriter, r *http.Request) {
	slots := []config.PartnerSlot{config.SlotA, config.SlotB}
	views := make([]accountView, 0, len(slots))
	for _, slot := range slots {
		if s.cfg.MockEvents {
			views = append(views, s.mockAccountView(slot))
			continue
		}
		account, err := s.store.GetAccount(slot)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to load accounts")
			return
		}
		views = append(views, s.toAccountView(slot, account))
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"accounts":         views,
		"googleConfigured": s.cfg.IsGoogleConfigured(),
	})
}

func (s *Server) mockAccountView(slot config.PartnerSlot) accountView {
	info := s.cfg.Partner(slot)
	email := strings.ToLower(strings.ReplaceAll(info.Name, " ", ".")) + "@example.com"
	return accountView{Slot: string(slot), Name: info.Name, Color: info.Color, Connected: true, Email: &email}
}

func (s *Server) handleConnectAccount(w http.ResponseWriter, r *http.Request) {
	slot, ok := config.ParseSlot(r.PathValue("slot"))
	if !ok {
		writeError(w, http.StatusBadRequest, "Invalid slot")
		return
	}
	if !s.cfg.IsGoogleConfigured() {
		writeError(w, http.StatusBadRequest, "Google OAuth is not configured on the server")
		return
	}
	http.Redirect(w, r, s.google.AuthURL(slot), http.StatusFound)
}

func (s *Server) handleGoogleCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")
	appURL := strings.TrimRight(s.cfg.PublicAppURL, "/")

	slot, ok := config.ParseSlot(state)
	if code == "" || !ok {
		http.Error(w, "Invalid OAuth callback", http.StatusBadRequest)
		return
	}

	result, err := s.google.ExchangeCode(r.Context(), code)
	if err != nil {
		http.Redirect(w, r, appURL+"/?error=oauth_failed", http.StatusFound)
		return
	}

	expiry := result.Token.Expiry.UnixMilli()
	err = s.store.UpsertAccountTokens(slot, store.UpsertTokensInput{
		Email:        result.Email,
		AccessToken:  result.Token.AccessToken,
		RefreshToken: result.Token.RefreshToken,
		ExpiryMillis: expiry,
	})
	if err != nil {
		http.Redirect(w, r, appURL+"/?error=oauth_failed", http.StatusFound)
		return
	}

	http.Redirect(w, r, appURL+"/?connected="+string(slot), http.StatusFound)
}

func (s *Server) handleDisconnectAccount(w http.ResponseWriter, r *http.Request) {
	slot, ok := config.ParseSlot(r.PathValue("slot"))
	if !ok {
		writeError(w, http.StatusBadRequest, "Invalid slot")
		return
	}
	if err := s.store.DeleteAccount(slot); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to disconnect account")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
