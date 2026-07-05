package config

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/viper"
)

// Config holds the CLI configuration stored at ~/.kubric/config.yaml.
// Only auth token, email, and the active cluster name are stored here —
// no cluster secrets, telemetry, or Kubernetes data.
type Config struct {
	Token         string `mapstructure:"token"`
	Email         string `mapstructure:"email"`
	ActiveCluster string `mapstructure:"active_cluster"`
}

// configDir returns the path to ~/.kubric/
func configDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("finding home directory: %w", err)
	}
	return filepath.Join(home, ".kubric"), nil
}

// Path returns the full expanded path to the config file.
func Path() (string, error) {
	dir, err := configDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "config.yaml"), nil
}

// Load reads the config from ~/.kubric/config.yaml.
// Returns an empty Config with no error if the file doesn't exist yet.
func Load() (*Config, error) {
	dir, err := configDir()
	if err != nil {
		return nil, err
	}

	v := viper.New()
	v.SetConfigName("config")
	v.SetConfigType("yaml")
	v.AddConfigPath(dir)

	// Set defaults so the struct always has valid zero values
	v.SetDefault("token", "")
	v.SetDefault("email", "")
	v.SetDefault("active_cluster", "")

	if err := v.ReadInConfig(); err != nil {
		// If the file doesn't exist, return an empty config — not an error
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			return &Config{}, nil
		}
		// Also handle the case where the directory doesn't exist at all
		if os.IsNotExist(err) {
			return &Config{}, nil
		}
		return nil, fmt.Errorf("reading config: %w", err)
	}

	cfg := &Config{}
	if err := v.Unmarshal(cfg); err != nil {
		return nil, fmt.Errorf("parsing config: %w", err)
	}

	return cfg, nil
}

// Save writes the config to ~/.kubric/config.yaml.
// Creates the ~/.kubric/ directory if it doesn't exist.
// Sets file permissions to 0600 since the file contains an auth token.
func Save(cfg *Config) error {
	dir, err := configDir()
	if err != nil {
		return err
	}

	// Create directory if missing
	if err := os.MkdirAll(dir, 0700); err != nil {
		return fmt.Errorf("creating config directory: %w", err)
	}

	cfgPath := filepath.Join(dir, "config.yaml")

	v := viper.New()
	v.Set("token", cfg.Token)
	v.Set("email", cfg.Email)
	v.Set("active_cluster", cfg.ActiveCluster)

	// Write to file
	if err := v.WriteConfigAs(cfgPath); err != nil {
		return fmt.Errorf("writing config: %w", err)
	}

	// Set restrictive permissions since file contains auth token
	if err := os.Chmod(cfgPath, 0600); err != nil {
		return fmt.Errorf("setting config file permissions: %w", err)
	}

	return nil
}
