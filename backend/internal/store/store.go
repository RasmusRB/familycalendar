// Package store persists Google OAuth tokens and shared-event links in Postgres.
package store

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	_ "github.com/jackc/pgx/v5/stdlib"

	"familycalendar/backend/internal/config"
)

type Store struct {
	db *sql.DB
}

type Account struct {
	Slot         config.PartnerSlot
	Email        sql.NullString
	AccessToken  sql.NullString
	RefreshToken sql.NullString
	TokenExpiry  sql.NullInt64
	CalendarID   string
	ConnectedAt  sql.NullInt64
}

type SharedLink struct {
	ID        string
	EventAID  string
	EventBID  string
	CreatedAt int64
}

// Open connects to Postgres and waits (with backoff) for it to become reachable,
// since the database container may still be starting up.
func Open(databaseURL string) (*Store, error) {
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(10)

	var pingErr error
	for attempt := 0; attempt < 20; attempt++ {
		if pingErr = db.Ping(); pingErr == nil {
			break
		}
		time.Sleep(time.Duration(attempt+1) * 500 * time.Millisecond)
	}
	if pingErr != nil {
		return nil, fmt.Errorf("could not connect to postgres: %w", pingErr)
	}

	schema := `
	CREATE TABLE IF NOT EXISTS accounts (
		slot TEXT PRIMARY KEY,
		email TEXT,
		access_token TEXT,
		refresh_token TEXT,
		token_expiry BIGINT,
		calendar_id TEXT NOT NULL DEFAULT 'primary',
		connected_at BIGINT
	);
	CREATE TABLE IF NOT EXISTS shared_links (
		id TEXT PRIMARY KEY,
		event_a_id TEXT NOT NULL,
		event_b_id TEXT NOT NULL,
		created_at BIGINT NOT NULL
	);
	`
	if _, err := db.Exec(schema); err != nil {
		return nil, err
	}

	return &Store{db: db}, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) GetAccount(slot config.PartnerSlot) (*Account, error) {
	row := s.db.QueryRow(
		`SELECT slot, email, access_token, refresh_token, token_expiry, calendar_id, connected_at
		 FROM accounts WHERE slot = $1`, string(slot),
	)
	var a Account
	var slotStr string
	err := row.Scan(&slotStr, &a.Email, &a.AccessToken, &a.RefreshToken, &a.TokenExpiry, &a.CalendarID, &a.ConnectedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	a.Slot = config.PartnerSlot(slotStr)
	return &a, nil
}

type UpsertTokensInput struct {
	Email        string
	AccessToken  string
	RefreshToken string // empty means "keep existing"
	ExpiryMillis int64
}

func (s *Store) UpsertAccountTokens(slot config.PartnerSlot, in UpsertTokensInput) error {
	existing, err := s.GetAccount(slot)
	if err != nil {
		return err
	}

	refreshToken := in.RefreshToken
	connectedAt := time.Now().UnixMilli()
	if existing != nil {
		if refreshToken == "" && existing.RefreshToken.Valid {
			refreshToken = existing.RefreshToken.String
		}
		if existing.ConnectedAt.Valid {
			connectedAt = existing.ConnectedAt.Int64
		}
	}

	_, err = s.db.Exec(
		`INSERT INTO accounts (slot, email, access_token, refresh_token, token_expiry, calendar_id, connected_at)
		 VALUES ($1, $2, $3, $4, $5, 'primary', $6)
		 ON CONFLICT (slot) DO UPDATE SET
		   email = excluded.email,
		   access_token = excluded.access_token,
		   refresh_token = COALESCE(NULLIF(excluded.refresh_token, ''), accounts.refresh_token),
		   token_expiry = excluded.token_expiry,
		   connected_at = excluded.connected_at`,
		string(slot), in.Email, in.AccessToken, refreshToken, in.ExpiryMillis, connectedAt,
	)
	return err
}

func (s *Store) UpdateAccessToken(slot config.PartnerSlot, accessToken string, expiryMillis int64) error {
	_, err := s.db.Exec(
		`UPDATE accounts SET access_token = $1, token_expiry = $2 WHERE slot = $3`,
		accessToken, expiryMillis, string(slot),
	)
	return err
}

func (s *Store) DeleteAccount(slot config.PartnerSlot) error {
	_, err := s.db.Exec(`DELETE FROM accounts WHERE slot = $1`, string(slot))
	return err
}

func (s *Store) CreateSharedLink(eventAID, eventBID string) (string, error) {
	id := uuid.NewString()
	_, err := s.db.Exec(
		`INSERT INTO shared_links (id, event_a_id, event_b_id, created_at) VALUES ($1, $2, $3, $4)`,
		id, eventAID, eventBID, time.Now().UnixMilli(),
	)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *Store) GetSharedLink(id string) (*SharedLink, error) {
	row := s.db.QueryRow(`SELECT id, event_a_id, event_b_id, created_at FROM shared_links WHERE id = $1`, id)
	var l SharedLink
	err := row.Scan(&l.ID, &l.EventAID, &l.EventBID, &l.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &l, nil
}

func (s *Store) FindSharedLinkByGoogleEventID(eventID string) (*SharedLink, error) {
	row := s.db.QueryRow(
		`SELECT id, event_a_id, event_b_id, created_at FROM shared_links WHERE event_a_id = $1 OR event_b_id = $1`,
		eventID,
	)
	var l SharedLink
	err := row.Scan(&l.ID, &l.EventAID, &l.EventBID, &l.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &l, nil
}

func (s *Store) DeleteSharedLink(id string) error {
	_, err := s.db.Exec(`DELETE FROM shared_links WHERE id = $1`, id)
	return err
}
