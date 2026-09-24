#!/bin/bash
# Cross-build the Windows x64 Electron installer from macOS.

set -euo pipefail
# Navigate to the project root directory
cd "$(dirname "$0")/.."
# Build the web assets and Windows installer using electron-builder.
npm run electron:dist:win

echo "Build completed successfully."
