#!/usr/bin/env bash
# Start the broker in the background. Logs to .broker.log; PID in .broker.pid.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PIDFILE="$ROOT/.broker.pid"
LOGFILE="$ROOT/.broker.log"

port_from_env() {
  local p=8080
  if [ -f "$ROOT/.env" ]; then
    local line
    line=$(grep -E '^[[:space:]]*PORT=' "$ROOT/.env" 2>/dev/null | tail -1 || true)
    if [ -n "${line:-}" ]; then
      p="${line#*=}"
      p="${p//[[:space:]]/}"
    fi
  fi
  echo "$p"
}

if [ -f "$PIDFILE" ]; then
  pid="$(cat "$PIDFILE" || true)"
  if [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null; then
    echo "Broker already running (PID $pid). Run: npm run broker:stop" >&2
    exit 1
  fi
  rm -f "$PIDFILE"
fi

PORT="$(port_from_env)"
export PORT

nohup node server.js >>"$LOGFILE" 2>&1 &
echo $! >"$PIDFILE"

echo "Broker started PID $(cat "$PIDFILE")"
echo "Log: $LOGFILE"
echo "Open: http://localhost:${PORT}/"
