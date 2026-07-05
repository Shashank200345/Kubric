package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

// ErrAuthPending is returned by PollDeviceToken when the user hasn't
// approved the login yet (HTTP 428). The caller should keep polling.
var ErrAuthPending = errors.New("authorization pending — user has not approved yet")

// StatusResponse matches the JSON shape returned by GET /v1/status.
type StatusResponse struct {
	HealthScore        int `json:"health_score"`
	ActiveIncidents    int `json:"active_incidents"`
	PodsRunning        int `json:"pods_running"`
	PodsTotal          int `json:"pods_total"`
	PrsPending         int `json:"prs_pending"`
	LastSyncedSecondsAgo int `json:"last_synced_seconds_ago"`
}

// Client is the single HTTP client used by every CLI command.
// Nothing outside this file should import net/http directly.
type Client struct {
	BaseURL    string
	Token      string
	httpClient *http.Client
}

// NewClient creates a Client with the given auth token.
// If baseURL is empty it defaults to http://localhost:8000 (local dev).
func NewClient(token string) *Client {
	return &Client{
		BaseURL: "http://localhost:8000",
		Token:   token,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// doRequest is a helper that executes an HTTP request with common headers.
func (c *Client) doRequest(req *http.Request) (*http.Response, error) {
	req.Header.Set("Content-Type", "application/json")
	if c.Token != "" {
		req.Header.Set("Authorization", "Bearer "+c.Token)
	}
	return c.httpClient.Do(req)
}

// StartDeviceAuth initiates the device auth flow.
// POST /v1/auth/device → { "verification_url": "...", "device_code": "..." }
func (c *Client) StartDeviceAuth() (verificationURL string, deviceCode string, err error) {
	url := c.BaseURL + "/v1/auth/device"

	req, err := http.NewRequest("POST", url, bytes.NewBufferString("{}"))
	if err != nil {
		return "", "", fmt.Errorf("creating device auth request: %w", err)
	}

	resp, err := c.doRequest(req)
	if err != nil {
		return "", "", fmt.Errorf("starting device auth: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", "", fmt.Errorf("starting device auth: server returned %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		VerificationURL string `json:"verification_url"`
		DeviceCode      string `json:"device_code"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", "", fmt.Errorf("parsing device auth response: %w", err)
	}

	return result.VerificationURL, result.DeviceCode, nil
}

// PollDeviceToken polls the backend for the auth token after the user approves.
// POST /v1/auth/device/token with { "device_code": deviceCode }
// Returns ErrAuthPending if the response is HTTP 428 (keep polling).
func (c *Client) PollDeviceToken(deviceCode string) (token string, email string, err error) {
	url := c.BaseURL + "/v1/auth/device/token"

	payload, err := json.Marshal(map[string]string{"device_code": deviceCode})
	if err != nil {
		return "", "", fmt.Errorf("marshaling device token request: %w", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(payload))
	if err != nil {
		return "", "", fmt.Errorf("creating device token request: %w", err)
	}

	resp, err := c.doRequest(req)
	if err != nil {
		return "", "", fmt.Errorf("polling device token: %w", err)
	}
	defer resp.Body.Close()

	// 428 Precondition Required means the user hasn't approved yet
	if resp.StatusCode == http.StatusPreconditionRequired {
		return "", "", ErrAuthPending
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", "", fmt.Errorf("polling device token: server returned %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Token string `json:"token"`
		Email string `json:"email"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", "", fmt.Errorf("parsing device token response: %w", err)
	}

	return result.Token, result.Email, nil
}

// ConnectCluster registers a cluster with Kubric and returns the Helm values
// needed to install the agent.
// POST /v1/clusters/connect with { "cluster_name": clusterName }
func (c *Client) ConnectCluster(clusterName string) (helmValues map[string]string, err error) {
	if c.Token == "" {
		return nil, fmt.Errorf("connecting cluster: not authenticated — run `kubric login` first")
	}

	url := c.BaseURL + "/v1/clusters/connect"

	payload, err := json.Marshal(map[string]string{"cluster_name": clusterName})
	if err != nil {
		return nil, fmt.Errorf("marshaling connect request: %w", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(payload))
	if err != nil {
		return nil, fmt.Errorf("creating connect request: %w", err)
	}

	resp, err := c.doRequest(req)
	if err != nil {
		return nil, fmt.Errorf("connecting cluster: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("connecting cluster: server returned %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		HelmValues map[string]string `json:"helm_values"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("parsing connect response: %w", err)
	}

	return result.HelmValues, nil
}

// GetStatus fetches the cluster status from the backend.
// GET /v1/status?cluster=<clusterName>
func (c *Client) GetStatus(clusterName string) (*StatusResponse, error) {
	if c.Token == "" {
		return nil, fmt.Errorf("fetching status: not authenticated — run `kubric login` first")
	}

	url := fmt.Sprintf("%s/v1/status?cluster=%s", c.BaseURL, clusterName)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("creating status request: %w", err)
	}

	resp, err := c.doRequest(req)
	if err != nil {
		return nil, fmt.Errorf("fetching status: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("fetching status: not authorized — run `kubric login` to re-authenticate")
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("fetching status: server returned %d: %s", resp.StatusCode, string(body))
	}

	var status StatusResponse
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		return nil, fmt.Errorf("parsing status response: %w", err)
	}

	return &status, nil
}
