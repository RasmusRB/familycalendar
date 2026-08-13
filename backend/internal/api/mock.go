package api

import (
	"sync"
	"time"

	"github.com/google/uuid"

	"familycalendar/backend/internal/config"
)

// mockEventStore is an in-memory stand-in for Google Calendar, used when
// MOCK_EVENTS is on so the app can be tried out without OAuth configured.
type mockEventStore struct {
	mu     sync.Mutex
	events map[string]normalizedEvent
}

func newMockEventStore(cfg config.Config) *mockEventStore {
	s := &mockEventStore{events: map[string]normalizedEvent{}}
	s.seed(cfg)
	return s
}

func (s *mockEventStore) seed(cfg config.Config) {
	now := time.Now()
	dayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	at := func(dayOffset, hour, min int) time.Time {
		return dayStart.AddDate(0, 0, dayOffset).Add(time.Duration(hour)*time.Hour + time.Duration(min)*time.Minute)
	}
	dateOnly := func(dayOffset int) string {
		return dayStart.AddDate(0, 0, dayOffset).Format("2006-01-02")
	}

	type seedEvent struct {
		owner       string
		title       string
		description string
		location    string
		start       time.Time
		end         time.Time
		allDay      bool
		allDayStart string
		allDayEnd   string
	}

	seeds := []seedEvent{
		{owner: "a", title: "Morning run", start: at(0, 6, 30), end: at(0, 7, 15)},
		{owner: "b", title: "Team standup", location: "Zoom", start: at(0, 9, 0), end: at(0, 9, 30)},
		{owner: "shared", title: "Dinner with the Andersons", location: "Bellwether", description: "Bring the good wine.", start: at(0, 19, 0), end: at(0, 21, 0)},

		{owner: "a", title: "Dentist appointment", location: "Riverside Dental", start: at(1, 10, 0), end: at(1, 11, 0)},
		{owner: "b", title: "Grocery run", start: at(1, 17, 30), end: at(1, 18, 15)},

		{owner: "shared", title: "Movie night", description: "Her pick this time.", start: at(2, 20, 0), end: at(2, 22, 0)},
		{owner: "a", title: "Gym", start: at(3, 6, 30), end: at(3, 7, 30)},
		{owner: "b", title: "Call with parents", start: at(3, 18, 0), end: at(3, 18, 30)},

		{owner: "a", title: "1:1 with manager", location: "Conf room B", start: at(4, 14, 0), end: at(4, 14, 30)},
		{owner: "shared", title: "Date night", location: "Downtown", start: at(4, 19, 30), end: at(4, 22, 0)},

		{owner: "b", title: "Farmers market", start: at(5, 9, 0), end: at(5, 10, 0)},
		{owner: "a", title: "Car service", location: "AutoCare Center", start: at(6, 8, 0), end: at(6, 9, 0)},

		{owner: "shared", title: "Weekly meal prep", start: at(-1, 11, 0), end: at(-1, 12, 30)},
		{owner: "a", title: "Yoga class", start: at(-2, 18, 0), end: at(-2, 19, 0)},

		{owner: "a", title: "Quarterly review", start: at(9, 13, 0), end: at(9, 14, 0)},
		{owner: "b", title: "Haircut", start: at(11, 16, 0), end: at(11, 16, 45)},
	}

	for _, sd := range seeds {
		id := "mock-" + uuid.NewString()
		owner := sd.owner
		color := cfg.Partner(config.PartnerSlot(owner)).Color
		if owner == "shared" {
			color = "shared"
		}
		s.events[id] = normalizedEvent{
			ID:          id,
			Owner:       owner,
			Color:       color,
			Title:       sd.title,
			Description: nonEmpty(sd.description),
			Location:    nonEmpty(sd.location),
			Start:       sd.start.Format(time.RFC3339),
			End:         sd.end.Format(time.RFC3339),
			AllDay:      false,
			Editable:    true,
		}
	}

	// A multi-day all-day trip, to exercise month-view spanning.
	tripID := "mock-" + uuid.NewString()
	s.events[tripID] = normalizedEvent{
		ID:       tripID,
		Owner:    "shared",
		Color:    "shared",
		Title:    "Anniversary trip",
		Location: nonEmpty("Lake House"),
		Start:    dateOnly(5),
		End:      dateOnly(8),
		AllDay:   true,
		Editable: true,
	}

	annivID := "mock-" + uuid.NewString()
	s.events[annivID] = normalizedEvent{
		ID:       annivID,
		Owner:    "a",
		Color:    cfg.Partner(config.SlotA).Color,
		Title:    "Kid's birthday",
		Start:    dateOnly(2),
		End:      dateOnly(3),
		AllDay:   true,
		Editable: true,
	}
}

func overlapsRange(evt normalizedEvent, startISO, endISO string) bool {
	rangeStart, err1 := time.Parse(time.RFC3339, startISO)
	rangeEnd, err2 := time.Parse(time.RFC3339, endISO)
	if err1 != nil || err2 != nil {
		return true
	}
	layout := time.RFC3339
	if evt.AllDay {
		layout = "2006-01-02"
	}
	evtStart, err := time.Parse(layout, evt.Start)
	if err != nil {
		return true
	}
	evtEnd, err := time.Parse(layout, evt.End)
	if err != nil {
		evtEnd = evtStart
	}
	return evtStart.Before(rangeEnd) && evtEnd.After(rangeStart)
}

func (s *mockEventStore) List(startISO, endISO string) []normalizedEvent {
	s.mu.Lock()
	defer s.mu.Unlock()

	results := make([]normalizedEvent, 0, len(s.events))
	for _, evt := range s.events {
		if overlapsRange(evt, startISO, endISO) {
			results = append(results, evt)
		}
	}
	return results
}

func (s *mockEventStore) Create(cfg config.Config, body eventDraftRequest) normalizedEvent {
	s.mu.Lock()
	defer s.mu.Unlock()

	id := "mock-" + uuid.NewString()
	color := cfg.Partner(config.PartnerSlot(body.Owner)).Color
	if body.Owner == "shared" {
		color = "shared"
	}
	evt := normalizedEvent{
		ID:          id,
		Owner:       body.Owner,
		Color:       color,
		Title:       body.Title,
		Description: nonEmpty(body.Description),
		Location:    nonEmpty(body.Location),
		Start:       body.Start,
		End:         body.End,
		AllDay:      body.AllDay,
		Editable:    true,
	}
	s.events[id] = evt
	return evt
}

func (s *mockEventStore) Update(id string, body eventDraftRequest) (normalizedEvent, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing, ok := s.events[id]
	if !ok {
		return normalizedEvent{}, false
	}
	existing.Title = body.Title
	existing.Description = nonEmpty(body.Description)
	existing.Location = nonEmpty(body.Location)
	existing.Start = body.Start
	existing.End = body.End
	existing.AllDay = body.AllDay
	s.events[id] = existing
	return existing, true
}

func (s *mockEventStore) Delete(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.events[id]; !ok {
		return false
	}
	delete(s.events, id)
	return true
}
