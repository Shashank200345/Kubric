package output

import (
	"fmt"
	"os"

	"golang.org/x/sys/windows"
)

// ANSI escape codes
const (
	colorReset  = "\033[0m"
	colorGreen  = "\033[32m"
	colorYellow = "\033[33m"
	colorRed    = "\033[31m"
)

// isTerminal checks if stdout is connected to a terminal (not piped/redirected).
func isTerminal() bool {
	fd := os.Stdout.Fd()
	var mode uint32
	err := windows.GetConsoleMode(windows.Handle(fd), &mode)
	return err == nil
}

// colorize wraps text in ANSI color codes if the terminal supports it.
func colorize(color, text string) string {
	if !isTerminal() {
		return text
	}
	return color + text + colorReset
}

// Success prints "✓ <msg>" in green if color is supported.
func Success(msg string) {
	if isTerminal() {
		fmt.Printf("%s✓ %s%s\n", colorGreen, msg, colorReset)
	} else {
		fmt.Printf("✓ %s\n", msg)
	}
}

// Error prints "✗ <msg>" in red if color is supported.
func Error(msg string) {
	if isTerminal() {
		fmt.Fprintf(os.Stderr, "%s✗ %s%s\n", colorRed, msg, colorReset)
	} else {
		fmt.Fprintf(os.Stderr, "✗ %s\n", msg)
	}
}

// Info prints "→ <msg>" in default color.
func Info(msg string) {
	fmt.Printf("→ %s\n", msg)
}

// ColorizeHealthScore returns the score as a string colored based on
// thresholds: green >= 80, yellow 60-79, red < 60.
func ColorizeHealthScore(score int) string {
	text := fmt.Sprintf("%d", score)
	switch {
	case score >= 80:
		return colorize(colorGreen, text)
	case score >= 60:
		return colorize(colorYellow, text)
	default:
		return colorize(colorRed, text)
	}
}
