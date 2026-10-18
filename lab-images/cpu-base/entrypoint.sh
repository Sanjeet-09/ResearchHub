#!/usr/bin/env bash
set -e

mkdir -p /workspace/.lab

# Restore pip packages if requirements.lock exists from a prior checkpoint
if [ -f "/workspace/.lab/requirements.lock" ]; then
  echo "Restoring packages from /workspace/.lab/requirements.lock..."
  pip install --no-cache-dir -r /workspace/.lab/requirements.lock || true
fi

# Launch JupyterLab with root dir /workspace and dark theme
exec jupyter lab --config=/etc/jupyter/jupyter_server_config.py --no-browser "$@"
