package cmd

import (
	"fmt"
	"os"
	"strings"

	"github.com/kubric-dev/kubric-cli/internal/api"
	"github.com/kubric-dev/kubric-cli/internal/config"
	"github.com/kubric-dev/kubric-cli/internal/output"
	"github.com/spf13/cobra"
)

var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "Check cluster health at a glance",
	Long: `Displays a quick status snapshot of your connected Kubernetes cluster,
including health score, active incidents, pod counts, and pending PRs.`,
	RunE: runStatus,
}

func init() {
	rootCmd.AddCommand(statusCmd)
}

func runStatus(cmd *cobra.Command, args []string) error {
	// 1. Load config and validate
	cfg, err := config.Load()
	if err != nil {
		output.Error(fmt.Sprintf("Failed to load config: %s", err))
		return err
	}

	if cfg.Token == "" {
		output.Error("Run `kubric login` first.")
		os.Exit(1)
	}

	if cfg.ActiveCluster == "" {
		output.Error("Run `kubric connect` first.")
		os.Exit(1)
	}

	// 2. Fetch status from backend
	client := api.NewClient(cfg.Token)
	status, err := client.GetStatus(cfg.ActiveCluster)
	if err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "not authorized") || strings.Contains(errMsg, "401") {
			output.Error("Authentication expired. Run `kubric login` to re-authenticate.")
		} else {
			output.Error(fmt.Sprintf("Failed to fetch status: %s", err))
			output.Info("Check your internet connection and try again.")
		}
		os.Exit(1)
	}

	// 3. Print formatted output
	fmt.Println()
	fmt.Printf("%s · synced %ds ago\n", cfg.ActiveCluster, status.LastSyncedSecondsAgo)
	fmt.Printf("Health score: %s\n", output.ColorizeHealthScore(status.HealthScore))
	fmt.Printf("Active incidents: %d\n", status.ActiveIncidents)
	fmt.Printf("Pods: %d/%d running\n", status.PodsRunning, status.PodsTotal)
	fmt.Printf("Open PRs pending review: %d\n", status.PrsPending)
	fmt.Println()

	return nil
}
