// Package window holds the Windows-specific window tweaks.
package window

import (
	"sync"
	"syscall"

	"github.com/lxn/win"
)

const windowTitle = "airchat"

// ClickThrough toggles mouse click-through on the app window.
type ClickThrough struct {
	mu   sync.Mutex
	hwnd win.HWND
}

// Set enables or disables click-through. The window handle is resolved
// lazily because the window may not exist yet at startup.
func (c *ClickThrough) Set(enabled bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.hwnd == 0 {
		title, err := syscall.UTF16PtrFromString(windowTitle)
		if err != nil {
			return
		}
		c.hwnd = win.FindWindow(nil, title)
		if c.hwnd == 0 {
			return
		}
	}

	style := win.GetWindowLong(c.hwnd, win.GWL_EXSTYLE)
	const flags = win.WS_EX_LAYERED | win.WS_EX_TRANSPARENT
	if enabled {
		win.SetWindowLong(c.hwnd, win.GWL_EXSTYLE, style|flags)
	} else {
		win.SetWindowLong(c.hwnd, win.GWL_EXSTYLE, style&^flags)
	}
}
