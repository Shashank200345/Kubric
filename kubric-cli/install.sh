#!/bin/sh
# Kubric CLI installer
# Usage: curl -sSL https://get.kubric.dev | sh
set -e

# Detect OS
OS="$(uname -s)"
case "$OS" in
    Darwin) OS="darwin" ;;
    Linux)  OS="linux" ;;
    *)
        echo "✗ Unsupported operating system: $OS"
        echo "  Kubric CLI supports macOS and Linux."
        exit 1
        ;;
esac

# Detect architecture
ARCH="$(uname -m)"
case "$ARCH" in
    x86_64)  ARCH="amd64" ;;
    amd64)   ARCH="amd64" ;;
    aarch64) ARCH="arm64" ;;
    arm64)   ARCH="arm64" ;;
    *)
        echo "✗ Unsupported architecture: $ARCH"
        echo "  Kubric CLI supports amd64 and arm64."
        exit 1
        ;;
esac

BINARY="kubric-${OS}-${ARCH}"
DOWNLOAD_URL="https://github.com/kubric-dev/kubric-cli/releases/latest/download/${BINARY}"

echo "→ Downloading kubric for ${OS}/${ARCH}..."

# Download the binary
if ! curl -fsSL -o /tmp/kubric "$DOWNLOAD_URL"; then
    echo "✗ Download failed. Check https://github.com/kubric-dev/kubric-cli/releases"
    exit 1
fi

chmod +x /tmp/kubric

# Install to a directory on PATH
INSTALL_DIR="/usr/local/bin"
if [ -w "$INSTALL_DIR" ]; then
    mv /tmp/kubric "${INSTALL_DIR}/kubric"
    echo "✓ kubric installed to ${INSTALL_DIR}/kubric"
else
    # Fall back to ~/.local/bin if /usr/local/bin isn't writable without sudo
    INSTALL_DIR="${HOME}/.local/bin"
    mkdir -p "$INSTALL_DIR"
    mv /tmp/kubric "${INSTALL_DIR}/kubric"
    echo "✓ kubric installed to ${INSTALL_DIR}/kubric"

    # Check if ~/.local/bin is on PATH
    case ":$PATH:" in
        *":${INSTALL_DIR}:"*) ;;
        *)
            echo ""
            echo "→ Note: ${INSTALL_DIR} is not in your PATH."
            echo "  Add it by running:"
            echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
            echo "  (add this line to your ~/.bashrc or ~/.zshrc to make it permanent)"
            ;;
    esac
fi

echo ""
echo "✓ kubric installed. Run \`kubric login\` to get started."
