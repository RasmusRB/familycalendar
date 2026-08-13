// Command server runs the family calendar API.
package main

import (
	"log"
	"net/http"

	"familycalendar/backend/internal/api"
	"familycalendar/backend/internal/config"
	"familycalendar/backend/internal/store"
)

func main() {
	cfg := config.Load()

	st, err := store.Open(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}
	defer st.Close()

	srv := api.NewServer(cfg, st)

	addr := ":" + cfg.Port
	log.Printf("Family calendar API listening on port %s", cfg.Port)
	if err := http.ListenAndServe(addr, srv.Handler()); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
