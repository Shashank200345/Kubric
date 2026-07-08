package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var jsonOutput bool

// rootCmd is the base command for the kubric CLI.
var rootCmd = &cobra.Command{
	Use:   "kubric",
	Short: "The Kubric CLI — connects your cluster to Kubric.",
	Long: `The Kubric CLI connects your Kubernetes clusters to Kubric's intelligence 
platform by installing the in-cluster agent.`,
}

// Execute is called from main.go to run the root command.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func init() {
	// Global persistent flag for future JSON output support
	rootCmd.PersistentFlags().BoolVar(&jsonOutput, "json", false, "Output in JSON format (reserved for future use)")
}
