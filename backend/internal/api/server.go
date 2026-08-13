// Package api wires the HTTP routes for the family calendar backend.
package api

import (
	"log"
	"net/http"
	"strings"

	"familycalendar/backend/internal/config"
	"familycalendar/backend/internal/googlecal"
	"familycalendar/backend/internal/session"
	"familycalendar/backend/internal/store"
)

type Server struct {
	cfg     config.Config
	store   *store.Store
	google  *googlecal.Client
	session *session.Manager
	mock    *mockEventStore
}

func NewServer(cfg config.Config, st *store.Store) *Server {
	s := &Server{
		cfg:     cfg,
		store:   st,
		google:  googlecal.New(cfg),
		session: session.NewManager(cfg.SessionKey, cfg.AppEnv == "production"),
	}
	if cfg.MockEvents {
		log.Println("MOCK_EVENTS enabled: serving generated fake events instead of Google Calendar")
		s.mock = newMockEventStore(cfg)
	}
	return s
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	})

	mux.HandleFunc("POST /api/auth/login", s.handleLogin)
	mux.HandleFunc("POST /api/auth/logout", s.handleLogout)
	mux.HandleFunc("GET /api/auth/session", s.handleSession)

	mux.HandleFunc("GET /api/accounts", s.requireAuth(s.handleListAccounts))
	mux.HandleFunc("GET /api/accounts/{slot}/connect", s.requireAuth(s.handleConnectAccount))
	mux.HandleFunc("GET /api/accounts/google/callback", s.requireAuth(s.handleGoogleCallback))
	mux.HandleFunc("DELETE /api/accounts/{slot}", s.requireAuth(s.handleDisconnectAccount))

	mux.HandleFunc("GET /api/events", s.requireAuth(s.handleListEvents))
	mux.HandleFunc("POST /api/events", s.requireAuth(s.handleCreateEvent))
	mux.HandleFunc("PATCH /api/events/{id}", s.requireAuth(s.handleUpdateEvent))
	mux.HandleFunc("DELETE /api/events/{id}", s.requireAuth(s.handleDeleteEvent))

	return s.withMiddleware(mux)
}

func (s *Server) withMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := strings.TrimRight(s.cfg.PublicAppURL, "/")
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("panic handling %s %s: %v", r.Method, r.URL.Path, rec)
				writeError(w, http.StatusInternalServerError, "Internal server error")
			}
		}()

		next.ServeHTTP(w, r)
	})
}

func (s *Server) requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.session.IsAuthenticated(r) {
			writeError(w, http.StatusUnauthorized, "Not authenticated")
			return
		}
		next(w, r)
	}
}
