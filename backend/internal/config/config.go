// Package config loads runtime configuration from the environment.
package config

import (
	"os"

	"github.com/joho/godotenv"
)

type PartnerSlot string

const (
	SlotA PartnerSlot = "a"
	SlotB PartnerSlot = "b"
)

type PartnerInfo struct {
	Name  string
	Color string
}

type Config struct {
	Port        string
	AppEnv      string
	DatabaseURL string
	AppPassword string
	SessionKey  string

	PublicAppURL string
	PublicAPIURL string

	GoogleClientID     string
	GoogleClientSecret string

	PartnerAName string
	PartnerBName string

	// MockEvents serves generated fake events/accounts instead of calling Google,
	// so the UI can be tried out without OAuth configured.
	MockEvents bool
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// Load reads a .env file if present (ignored if missing) and builds the Config.
func Load() Config {
	_ = godotenv.Load()

	return Config{
		Port:   getenv("PORT", "4000"),
		AppEnv: getenv("APP_ENV", "development"),
		DatabaseURL: getenv(
			"DATABASE_URL",
			"postgres://familycalendar:familycalendar@localhost:5432/familycalendar?sslmode=disable",
		),
		AppPassword: getenv("APP_PASSWORD", "change-me"),
		SessionKey:  getenv("SESSION_SECRET", "dev-secret-change-me"),

		PublicAppURL: getenv("PUBLIC_APP_URL", "http://localhost:5173"),
		PublicAPIURL: getenv("PUBLIC_API_URL", "http://localhost:4000"),

		GoogleClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),

		PartnerAName: getenv("PARTNER_A_NAME", "Partner A"),
		PartnerBName: getenv("PARTNER_B_NAME", "Partner B"),

		MockEvents: parseMockEvents(),
	}
}

// parseMockEvents defaults to on outside production when Google OAuth isn't
// configured (so the app is browsable out of the box), but always respects an
// explicit MOCK_EVENTS override.
func parseMockEvents() bool {
	if v := os.Getenv("MOCK_EVENTS"); v != "" {
		return v == "true" || v == "1"
	}
	googleConfigured := os.Getenv("GOOGLE_CLIENT_ID") != "" && os.Getenv("GOOGLE_CLIENT_SECRET") != ""
	return getenv("APP_ENV", "development") != "production" && !googleConfigured
}

func (c Config) Partner(slot PartnerSlot) PartnerInfo {
	if slot == SlotA {
		return PartnerInfo{Name: c.PartnerAName, Color: "partner-a"}
	}
	return PartnerInfo{Name: c.PartnerBName, Color: "partner-b"}
}

func (c Config) IsGoogleConfigured() bool {
	return c.GoogleClientID != "" && c.GoogleClientSecret != ""
}

func ParseSlot(s string) (PartnerSlot, bool) {
	switch PartnerSlot(s) {
	case SlotA, SlotB:
		return PartnerSlot(s), true
	default:
		return "", false
	}
}
