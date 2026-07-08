package cmd

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"

	"time"

	"github.com/kubric-dev/kubric-cli/internal/api"
	"github.com/kubric-dev/kubric-cli/internal/config"
	"github.com/kubric-dev/kubric-cli/internal/output"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
)

// agentChartRef points at the local placeholder chart for testing.
// TODO: swap to "kubric/kubric-agent" once the chart is published to a real Helm repo.
const agentChartRef = "./charts/kubric-agent"

var connectCmd = &cobra.Command{
	Use:   "connect",
	Short: "Install the Kubric agent on a Kubernetes cluster",
	Long: `Connects a Kubernetes cluster to Kubric by installing the Kubric agent via Helm.
The command discovers available kube contexts, registers the selected cluster 
with Kubric, and runs the Helm install with streaming output.`,
	RunE: runConnect,
}

func init() {
	rootCmd.AddCommand(connectCmd)
}

func runConnect(cmd *cobra.Command, args []string) error {
	// 1. Load config and check for auth token
	cfg, err := config.Load()
	if err != nil {
		output.Error(fmt.Sprintf("Failed to load config: %s", err))
		return err
	}
	if cfg.Token == "" {
		output.Error("Run `kubric login` first.")
		os.Exit(1)
	}

	// 2. Discover kube contexts
	output.Info("Discovering Kubernetes clusters...")

	ctxOutput, err := exec.Command("kubectl", "config", "get-contexts", "-o", "name").CombinedOutput()
	if err != nil {
		output.Error(fmt.Sprintf("Failed to list Kubernetes clusters: %s", err))
		output.Error("Make sure kubectl is installed and your kubeconfig is valid.")
		os.Exit(1)
	}

	var contexts []string
	for _, line := range strings.Split(strings.TrimSpace(string(ctxOutput)), "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed != "" {
			contexts = append(contexts, trimmed)
		}
	}

	if len(contexts) == 0 {
		output.Error("No Kubernetes clusters found in your kubeconfig.")
		os.Exit(1)
	}

	var selectedCluster string

	if len(contexts) == 1 {
		// Auto-select the only cluster
		selectedCluster = contexts[0]
		output.Info(fmt.Sprintf("Auto-selected cluster: %s", selectedCluster))
	} else {
		// Interactive picker
		fmt.Println()
		fmt.Println("Available clusters:")
		for i, ctx := range contexts {
			fmt.Printf("  %d) %s\n", i+1, ctx)
		}
		fmt.Println()

		reader := bufio.NewReader(os.Stdin)
		for {
			fmt.Printf("Select a cluster (1-%d): ", len(contexts))
			input, _ := reader.ReadString('\n')
			input = strings.TrimSpace(input)

			choice, parseErr := strconv.Atoi(input)
			if parseErr != nil || choice < 1 || choice > len(contexts) {
				output.Error(fmt.Sprintf("Invalid choice. Enter a number between 1 and %d.", len(contexts)))
				continue
			}

			selectedCluster = contexts[choice-1]
			break
		}
		output.Info(fmt.Sprintf("Selected cluster: %s", selectedCluster))
	}

	// 3. Call the backend to register the cluster and get Helm values
	output.Info("Registering cluster with Kubric...")

	client := api.NewClient(cfg.Token)
	helmValues, err := client.ConnectCluster(selectedCluster)
	if err != nil {
		output.Error(fmt.Sprintf("Failed to register cluster: %s", err))
		os.Exit(1)
	}

	// 4. Write Helm values to a temporary file
	tmpFile, err := os.CreateTemp("", "kubric-helm-values-*.yaml")
	if err != nil {
		output.Error(fmt.Sprintf("Failed to create temp file: %s", err))
		return err
	}
	defer os.Remove(tmpFile.Name()) // Clean up regardless of outcome

	yamlData, err := yaml.Marshal(helmValues)
	if err != nil {
		output.Error(fmt.Sprintf("Failed to marshal Helm values: %s", err))
		return err
	}

	if _, err := tmpFile.Write(yamlData); err != nil {
		output.Error(fmt.Sprintf("Failed to write Helm values: %s", err))
		return err
	}
	tmpFile.Close()

	// 5. Shell out to Helm with live output streaming
	// First check if helm is available
	if _, helmCheckErr := exec.LookPath("helm"); helmCheckErr != nil {
		fmt.Println()
		output.Info("Helm is not installed — skipping agent installation.")
		output.Info("Install Helm (https://helm.sh) and run `kubric connect` again to install the agent.")
		output.Info("Registering cluster without agent installation for now.")
	} else {
		output.Info("Installing Kubric agent via Helm...")
		fmt.Println()

		helmCmd := exec.Command("helm", "upgrade", "--install", "kubric-agent", agentChartRef,
			"--namespace", "kubric-system",
			"--create-namespace",
			"--values", tmpFile.Name(),
		)

		// Stream stdout/stderr live to the terminal
		helmCmd.Stdout = os.Stdout
		helmCmd.Stderr = os.Stderr

		if helmErr := helmCmd.Run(); helmErr != nil {
			fmt.Println()
			output.Info("Note: Helm install did not complete (the kubric-agent chart may not be published yet).")
			output.Info("Your cluster has been registered with Kubric. The agent can be installed later.")
		}
	}

	// 6. Update config with the active cluster
	cfg.ActiveCluster = selectedCluster
	if saveErr := config.Save(cfg); saveErr != nil {
		output.Error(fmt.Sprintf("Warning: Failed to save active cluster to config: %s", saveErr))
		// Don't exit — the registration succeeded, config is a non-fatal issue
	}

	// 7. Wait 3 seconds, then call status once automatically
	time.Sleep(3 * time.Second)
	status, err := client.GetStatus(selectedCluster)
	if err != nil {
		fmt.Println()
		output.Success("Kubric is watching your cluster")
		fmt.Println("  (first status check will be ready in a minute — check the dashboard at app.kubric.dev)")
	} else {
		fmt.Println()
		output.Success("Kubric is watching your cluster")
		fmt.Println()
		fmt.Printf("  %s · synced %ds ago\n", selectedCluster, status.LastSyncedSecondsAgo)
		fmt.Printf("  Health score: %s\n", output.ColorizeHealthScore(status.HealthScore))
		fmt.Printf("  Active incidents: %d\n", status.ActiveIncidents)
		fmt.Printf("  Pods: %d/%d running\n", status.PodsRunning, status.PodsTotal)
	}

	return nil
}
