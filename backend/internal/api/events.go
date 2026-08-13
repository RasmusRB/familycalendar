package api

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"

	"google.golang.org/api/calendar/v3"

	"familycalendar/backend/internal/config"
	"familycalendar/backend/internal/store"
)

var slots = []config.PartnerSlot{config.SlotA, config.SlotB}

type normalizedEvent struct {
	ID          string  `json:"id"`
	Owner       string  `json:"owner"`
	Color       string  `json:"color"`
	Title       string  `json:"title"`
	Description *string `json:"description"`
	Location    *string `json:"location"`
	Start       string  `json:"start"`
	End         string  `json:"end"`
	AllDay      bool    `json:"allDay"`
	HTMLLink    *string `json:"htmlLink"`
	Editable    bool    `json:"editable"`
}

func toGoogleTime(value string, allDay bool) *calendar.EventDateTime {
	if allDay {
		return &calendar.EventDateTime{Date: value}
	}
	return &calendar.EventDateTime{DateTime: value}
}

func fromGoogleTime(t *calendar.EventDateTime) (value string, allDay bool) {
	if t == nil {
		return "", false
	}
	if t.Date != "" {
		return t.Date, true
	}
	return t.DateTime, false
}

func nonEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func (s *Server) normalize(slot config.PartnerSlot, evt *calendar.Event, shared bool, linkID string) normalizedEvent {
	startVal, allDay := fromGoogleTime(evt.Start)
	endVal, _ := fromGoogleTime(evt.End)

	owner := string(slot)
	color := s.cfg.Partner(slot).Color
	id := fmt.Sprintf("%s:%s", slot, evt.Id)
	if shared {
		owner = "shared"
		color = "shared"
		id = "shared:" + linkID
	}

	title := evt.Summary
	if title == "" {
		title = "(Untitled event)"
	}

	return normalizedEvent{
		ID:          id,
		Owner:       owner,
		Color:       color,
		Title:       title,
		Description: nonEmpty(evt.Description),
		Location:    nonEmpty(evt.Location),
		Start:       startVal,
		End:         endVal,
		AllDay:      allDay,
		HTMLLink:    nonEmpty(evt.HtmlLink),
		Editable:    true,
	}
}

func isConnected(a *store.Account) bool {
	return a != nil && a.RefreshToken.Valid && a.RefreshToken.String != ""
}

// connectedCalendar loads the account for slot and, if connected, builds a Calendar service for it.
// Returns (nil, nil, nil) if the slot simply isn't connected yet.
func (s *Server) connectedCalendar(ctx context.Context, slot config.PartnerSlot) (*store.Account, *calendar.Service, error) {
	account, err := s.store.GetAccount(slot)
	if err != nil {
		return nil, nil, err
	}
	if !isConnected(account) {
		return nil, nil, nil
	}
	svc, err := s.google.CalendarService(ctx, s.store, account)
	if err != nil {
		return account, nil, err
	}
	return account, svc, nil
}

func (s *Server) handleListEvents(w http.ResponseWriter, r *http.Request) {
	start := r.URL.Query().Get("start")
	end := r.URL.Query().Get("end")
	if start == "" || end == "" {
		writeError(w, http.StatusBadRequest, "start and end query params are required")
		return
	}

	if s.cfg.MockEvents {
		writeJSON(w, http.StatusOK, map[string]any{"events": s.mock.List(start, end)})
		return
	}

	rawBySlot := map[config.PartnerSlot][]*calendar.Event{}
	for _, slot := range slots {
		_, svc, err := s.connectedCalendar(r.Context(), slot)
		if err != nil {
			log.Printf("failed to build calendar client for slot %s: %v", slot, err)
			continue
		}
		if svc == nil {
			continue
		}
		resp, err := svc.Events.List("primary").
			TimeMin(start).TimeMax(end).
			SingleEvents(true).OrderBy("startTime").MaxResults(2500).
			Do()
		if err != nil {
			log.Printf("failed to list events for slot %s: %v", slot, err)
			continue
		}
		rawBySlot[slot] = resp.Items
	}

	results := make([]normalizedEvent, 0)
	consumed := map[string]bool{}

	for _, slot := range slots {
		for _, evt := range rawBySlot[slot] {
			if evt.Id == "" {
				continue
			}
			key := string(slot) + ":" + evt.Id
			if consumed[key] {
				continue
			}

			link, err := s.store.FindSharedLinkByGoogleEventID(evt.Id)
			if err == nil && link != nil {
				consumed["a:"+link.EventAID] = true
				consumed["b:"+link.EventBID] = true
				results = append(results, s.normalize(slot, evt, true, link.ID))
				continue
			}
			results = append(results, s.normalize(slot, evt, false, ""))
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"events": results})
}

type eventDraftRequest struct {
	Owner       string `json:"owner"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Location    string `json:"location"`
	Start       string `json:"start"`
	End         string `json:"end"`
	AllDay      bool   `json:"allDay"`
}

func (b eventDraftRequest) validateCommon() string {
	if strings.TrimSpace(b.Title) == "" {
		return "title is required"
	}
	if b.Start == "" || b.End == "" {
		return "start and end are required"
	}
	return ""
}

func (b eventDraftRequest) toGoogleEvent() *calendar.Event {
	return &calendar.Event{
		Summary:     b.Title,
		Description: b.Description,
		Location:    b.Location,
		Start:       toGoogleTime(b.Start, b.AllDay),
		End:         toGoogleTime(b.End, b.AllDay),
	}
}

func (s *Server) handleCreateEvent(w http.ResponseWriter, r *http.Request) {
	var body eventDraftRequest
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if msg := body.validateCommon(); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	if body.Owner != "a" && body.Owner != "b" && body.Owner != "shared" {
		writeError(w, http.StatusBadRequest, "owner must be \"a\", \"b\", or \"shared\"")
		return
	}

	if s.cfg.MockEvents {
		writeJSON(w, http.StatusCreated, map[string]any{"event": s.mock.Create(s.cfg, body)})
		return
	}

	requestBody := body.toGoogleEvent()

	if body.Owner == "shared" {
		accA, svcA, errA := s.connectedCalendar(r.Context(), config.SlotA)
		accB, svcB, errB := s.connectedCalendar(r.Context(), config.SlotB)
		if errA != nil || errB != nil || !isConnected(accA) || !isConnected(accB) {
			writeError(w, http.StatusBadRequest, "Both partners must connect Google Calendar to create a shared event")
			return
		}

		evtA, err := svcA.Events.Insert("primary", requestBody).Do()
		if err != nil {
			log.Printf("failed to create shared event (a): %v", err)
			writeError(w, http.StatusBadGateway, "Failed to create event in Google Calendar")
			return
		}
		evtB, err := svcB.Events.Insert("primary", requestBody).Do()
		if err != nil {
			log.Printf("failed to create shared event (b): %v", err)
			writeError(w, http.StatusBadGateway, "Failed to create event in Google Calendar")
			return
		}

		linkID, err := s.store.CreateSharedLink(evtA.Id, evtB.Id)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to link shared event")
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"event": s.normalize(config.SlotA, evtA, true, linkID)})
		return
	}

	slot := config.PartnerSlot(body.Owner)
	account, svc, err := s.connectedCalendar(r.Context(), slot)
	if err != nil || !isConnected(account) {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("%s has not connected Google Calendar", s.cfg.Partner(slot).Name))
		return
	}

	evt, err := svc.Events.Insert("primary", requestBody).Do()
	if err != nil {
		log.Printf("failed to create event: %v", err)
		writeError(w, http.StatusBadGateway, "Failed to create event in Google Calendar")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"event": s.normalize(slot, evt, false, "")})
}

type parsedEventID struct {
	shared   bool
	linkID   string
	slot     config.PartnerSlot
	googleID string
}

func parseEventID(id string) (parsedEventID, bool) {
	if rest, ok := strings.CutPrefix(id, "shared:"); ok && rest != "" {
		return parsedEventID{shared: true, linkID: rest}, true
	}
	slotPart, googleID, ok := strings.Cut(id, ":")
	if !ok || googleID == "" {
		return parsedEventID{}, false
	}
	slot, ok := config.ParseSlot(slotPart)
	if !ok {
		return parsedEventID{}, false
	}
	return parsedEventID{slot: slot, googleID: googleID}, true
}

func (s *Server) handleUpdateEvent(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	if s.cfg.MockEvents {
		var body eventDraftRequest
		if err := decodeJSON(r, &body); err != nil {
			writeError(w, http.StatusBadRequest, "Invalid request body")
			return
		}
		if msg := body.validateCommon(); msg != "" {
			writeError(w, http.StatusBadRequest, msg)
			return
		}
		evt, ok := s.mock.Update(id, body)
		if !ok {
			writeError(w, http.StatusNotFound, "Event not found")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"event": evt})
		return
	}

	parsed, ok := parseEventID(id)
	if !ok {
		writeError(w, http.StatusBadRequest, "Invalid event id")
		return
	}

	var body eventDraftRequest
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if msg := body.validateCommon(); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	requestBody := body.toGoogleEvent()

	if parsed.shared {
		link, err := s.store.GetSharedLink(parsed.linkID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to load shared event")
			return
		}
		if link == nil {
			writeError(w, http.StatusNotFound, "Shared event not found")
			return
		}
		accA, svcA, errA := s.connectedCalendar(r.Context(), config.SlotA)
		accB, svcB, errB := s.connectedCalendar(r.Context(), config.SlotB)
		if errA != nil || errB != nil || !isConnected(accA) || !isConnected(accB) {
			writeError(w, http.StatusBadRequest, "Both partners must be connected to edit a shared event")
			return
		}

		evtA, err := svcA.Events.Patch("primary", link.EventAID, requestBody).Do()
		if err != nil {
			log.Printf("failed to update shared event (a): %v", err)
			writeError(w, http.StatusBadGateway, "Failed to update event in Google Calendar")
			return
		}
		if _, err := svcB.Events.Patch("primary", link.EventBID, requestBody).Do(); err != nil {
			log.Printf("failed to update shared event (b): %v", err)
			writeError(w, http.StatusBadGateway, "Failed to update event in Google Calendar")
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"event": s.normalize(config.SlotA, evtA, true, link.ID)})
		return
	}

	account, svc, err := s.connectedCalendar(r.Context(), parsed.slot)
	if err != nil || !isConnected(account) {
		writeError(w, http.StatusBadRequest, "Partner not connected")
		return
	}
	evt, err := svc.Events.Patch("primary", parsed.googleID, requestBody).Do()
	if err != nil {
		log.Printf("failed to update event: %v", err)
		writeError(w, http.StatusBadGateway, "Failed to update event in Google Calendar")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"event": s.normalize(parsed.slot, evt, false, "")})
}

func (s *Server) handleDeleteEvent(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	if s.cfg.MockEvents {
		if !s.mock.Delete(id) {
			writeError(w, http.StatusNotFound, "Event not found")
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
		return
	}

	parsed, ok := parseEventID(id)
	if !ok {
		writeError(w, http.StatusBadRequest, "Invalid event id")
		return
	}

	if parsed.shared {
		link, err := s.store.GetSharedLink(parsed.linkID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to load shared event")
			return
		}
		if link == nil {
			writeError(w, http.StatusNotFound, "Shared event not found")
			return
		}

		if _, svcA, err := s.connectedCalendar(r.Context(), config.SlotA); err == nil && svcA != nil {
			if err := svcA.Events.Delete("primary", link.EventAID).Do(); err != nil {
				log.Printf("failed to delete shared event (a): %v", err)
			}
		}
		if _, svcB, err := s.connectedCalendar(r.Context(), config.SlotB); err == nil && svcB != nil {
			if err := svcB.Events.Delete("primary", link.EventBID).Do(); err != nil {
				log.Printf("failed to delete shared event (b): %v", err)
			}
		}
		if err := s.store.DeleteSharedLink(link.ID); err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to remove shared event link")
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
		return
	}

	account, svc, err := s.connectedCalendar(r.Context(), parsed.slot)
	if err != nil || !isConnected(account) {
		writeError(w, http.StatusBadRequest, "Partner not connected")
		return
	}
	if err := svc.Events.Delete("primary", parsed.googleID).Do(); err != nil {
		log.Printf("failed to delete event: %v", err)
		writeError(w, http.StatusBadGateway, "Failed to delete event in Google Calendar")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
