package obs

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"

	"airchat/internal/chat"
)

// fakeOBS speaks just enough of the OBS WebSocket v5 protocol (no password)
// to exercise the Controller end to end against the real goobs client.
type fakeOBS struct {
	mu      sync.Mutex
	polls   int
	muted   map[string]bool
	volumes map[string]float64
}

func newFakeOBS() *fakeOBS {
	return &fakeOBS{muted: map[string]bool{}, volumes: map[string]float64{}}
}

func (f *fakeOBS) serve(t *testing.T) *httptest.Server {
	upgrader := websocket.Upgrader{Subprotocols: []string{"obswebsocket.json"}}
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()

		_ = conn.WriteJSON(map[string]any{"op": 0, "d": map[string]any{"obsWebSocketVersion": "5.5.0", "rpcVersion": 1}})
		for {
			var msg struct {
				Op int             `json:"op"`
				D  json.RawMessage `json:"d"`
			}
			if err := conn.ReadJSON(&msg); err != nil {
				return
			}
			switch msg.Op {
			case 1: // Identify
				_ = conn.WriteJSON(map[string]any{"op": 2, "d": map[string]any{"negotiatedRpcVersion": 1}})
			case 6: // Request
				var req struct {
					RequestType string          `json:"requestType"`
					RequestID   string          `json:"requestId"`
					RequestData json.RawMessage `json:"requestData"`
				}
				_ = json.Unmarshal(msg.D, &req)
				_ = conn.WriteJSON(map[string]any{"op": 7, "d": map[string]any{
					"requestType":   req.RequestType,
					"requestId":     req.RequestID,
					"requestStatus": map[string]any{"result": true, "code": 100},
					"responseData":  f.respond(req.RequestType, req.RequestData),
				}})
			}
		}
	}))
}

func (f *fakeOBS) respond(kind string, data json.RawMessage) map[string]any {
	f.mu.Lock()
	defer f.mu.Unlock()

	var input struct {
		InputName     string   `json:"inputName"`
		InputMuted    *bool    `json:"inputMuted"`
		InputVolumeDb *float64 `json:"inputVolumeDb"`
	}
	_ = json.Unmarshal(data, &input)

	switch kind {
	case "GetStreamStatus":
		f.polls++
		return map[string]any{
			"outputActive": true, "outputReconnecting": false, "outputTimecode": "00:00:01.000",
			"outputDuration": 1000, "outputCongestion": 0.0,
			"outputBytes":         f.polls * 625_000, // 5000 kbps at one poll per second
			"outputSkippedFrames": 0, "outputTotalFrames": f.polls * 60,
		}
	case "GetStats":
		return map[string]any{"activeFps": 60.0, "cpuUsage": 1.0}
	case "GetCurrentProgramScene":
		return map[string]any{"currentProgramSceneName": "Gameplay", "sceneName": "Gameplay"}
	case "GetSpecialInputs":
		return map[string]any{"desktop1": "Desktop Audio", "mic1": "Mic/Aux"}
	case "GetInputMute":
		return map[string]any{"inputMuted": f.muted[input.InputName]}
	case "GetInputVolume":
		return map[string]any{"inputVolumeMul": 1.0, "inputVolumeDb": f.volumes[input.InputName]}
	case "SetInputMute":
		f.muted[input.InputName] = *input.InputMuted
	case "SetInputVolume":
		f.volumes[input.InputName] = *input.InputVolumeDb
	}
	return map[string]any{}
}

type statusRecorder struct {
	mu       sync.Mutex
	statuses []Status
}

func (r *statusRecorder) Emit(event string, payload any) {
	if s, ok := payload.(Status); ok && event == EventStatus {
		r.mu.Lock()
		r.statuses = append(r.statuses, s)
		r.mu.Unlock()
	}
}

func (r *statusRecorder) all() []Status {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]Status(nil), r.statuses...)
}

func TestControllerAgainstFakeOBS(t *testing.T) {
	fake := newFakeOBS()
	server := fake.serve(t)
	defer server.Close()
	host := strings.TrimPrefix(server.URL, "http://")

	rec := &statusRecorder{}
	var emitter chat.Emitter = rec
	c := NewController(emitter)
	c.interval = 40 * time.Millisecond

	if err := c.Connect(context.Background(), host, ""); err != nil {
		t.Fatalf("Connect: %v", err)
	}
	defer c.Disconnect()

	// Status: after the second poll a baseline exists, so rates are real.
	deadline := time.Now().Add(3 * time.Second)
	var last Status
	for time.Now().Before(deadline) {
		if all := rec.all(); len(all) >= 3 {
			last = all[len(all)-1]
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	if !last.Connected || !last.OutputActive || last.CurrentScene != "Gameplay" || last.FPS != 60 {
		t.Fatalf("status not read from OBS: %+v", last)
	}
	if last.BitrateKbps <= 0 || last.StatusColor != "GREEN" {
		t.Fatalf("rates not computed: %+v", last)
	}

	// Audio inputs.
	inputs, err := c.AudioInputs()
	if err != nil {
		t.Fatalf("AudioInputs: %v", err)
	}
	if inputs["microphone"].Name != "Mic/Aux" || inputs["desktop"].Name != "Desktop Audio" {
		t.Fatalf("inputs = %+v", inputs)
	}

	// Mutations reach OBS and are read back.
	if err := c.SetInputMute("Mic/Aux", true); err != nil {
		t.Fatalf("SetInputMute: %v", err)
	}
	if err := c.SetInputVolume("Desktop Audio", -12.5); err != nil {
		t.Fatalf("SetInputVolume: %v", err)
	}
	inputs, _ = c.AudioInputs()
	if !inputs["microphone"].Muted || inputs["desktop"].Volume != -12.5 {
		t.Fatalf("mutations not applied: %+v", inputs)
	}

	// After Disconnect nothing more is emitted and calls fail cleanly.
	c.Disconnect()
	time.Sleep(100 * time.Millisecond)
	count := len(rec.all())
	time.Sleep(200 * time.Millisecond)
	if len(rec.all()) != count {
		t.Fatal("monitor kept emitting after Disconnect")
	}
	if _, err := c.AudioInputs(); err == nil {
		t.Fatal("AudioInputs should fail when disconnected")
	}
}

func TestConnectFailsCleanlyWhenOBSIsDown(t *testing.T) {
	c := NewController(&statusRecorder{})
	if err := c.Connect(context.Background(), "127.0.0.1:1", ""); err == nil {
		t.Fatal("expected an error when nothing listens")
	}
	if _, err := c.AudioInputs(); err == nil {
		t.Fatal("failed Connect must leave the controller disconnected")
	}
}
