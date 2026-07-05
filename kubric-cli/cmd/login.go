package cmd

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"time"

	"github.com/kubric-dev/kubric-cli/internal/api"
	"github.com/kubric-dev/kubric-cli/internal/config"
	"github.com/kubric-dev/kubric-cli/internal/output"
	"github.com/spf13/cobra"
)

var loginCmd = &cobra.Command{
	Use:   "login",
	Short: "Authenticate with your Kubric account",
	Long:  `Opens your browser to complete device authentication with Kubric.`,
	RunE:  runLogin,
}

func init() {
	rootCmd.AddCommand(loginCmd)
}

func runLogin(cmd *cobra.Command, args []string) error {
	// 1. Start device auth with an unauthenticated client
	client := api.NewClient("")

	output.Info("Starting authentication...")

	verificationURL, deviceCode, err := client.StartDeviceAuth()
	if err != nil {
		output.Error(fmt.Sprintf("Failed to start login: %s", err))
		return err
	}

	// 2. Print the verification URL
	output.Info("Opening browser to approve login...")
	output.Info(fmt.Sprintf("If it doesn't open automatically, visit: %s", verificationURL))

	// 3. Attempt to open the URL in the default browser
	openBrowser(verificationURL)

	// 4. Poll for the token with a spinner
	spinner := []rune{'⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'}
	spinIdx := 0
	timeout := time.After(60 * time.Second)
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-timeout:
			fmt.Print("\r\033[K") // clear the spinner line
			output.Error("Login timed out. Run `kubric login` to try again.")
			os.Exit(1)
		case <-ticker.C:
			// Update spinner
			fmt.Printf("\r%c Waiting for approval...", spinner[spinIdx%len(spinner)])
			spinIdx++

			token, email, err := client.PollDeviceToken(deviceCode)
			if err != nil {
				if errors.Is(err, api.ErrAuthPending) {
					continue // keep polling
				}
				fmt.Print("\r\033[K")
				output.Error(fmt.Sprintf("Login failed: %s", err))
				return err
			}

			// 5. Save token and email to config
			fmt.Print("\r\033[K") // clear the spinner line
			cfg, loadErr := config.Load()
			if loadErr != nil {
				cfg = &config.Config{}
			}
			cfg.Token = token
			cfg.Email = email

			if saveErr := config.Save(cfg); saveErr != nil {
				output.Error(fmt.Sprintf("Failed to save credentials: %s", saveErr))
				return saveErr
			}

			output.Success(fmt.Sprintf("Logged in as %s", email))
			return nil
		}
	}
}

// openBrowser tries to open the given URL in the default browser.
func openBrowser(url string) {
	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "linux":
		cmd = exec.Command("xdg-open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		return // unsupported OS, user has the URL printed
	}

	// Fire and forget — if it fails the user has the URL printed
	_ = cmd.Start()
}
