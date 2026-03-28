#!/usr/bin/env bash
# Stop the broker using .broker.pid, or any process listening on PORT (from .env or 8080).

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PIDFILE="$ROOT/.broker.pid"

port_from_env() {
  local p=8080
  if [ -f "$ROOT/.env" ]; then
    local line
    line=$(grep -E '^[[:space:]]*PORT=' "$ROOT/.env" | tail -1 || true)
    if [ -n "${line:-}" ]; then
      p="${line#*=}"
      p="${p//[[:space:]]/}"
    fi
  fi
  echo "$p"
}

PORT="$(port_from_env)"
stopped=0

if [ -f "$PIDFILE" ]; then
  pid="$(cat "$PIDFILE" 2>/dev/null || true)"
  if [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.15
    done
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
    echo "Stopped broker (PID $pid)"
    stopped=1
  fi
  rm -f "$PIDFILE"
fi

if [ "$stopped" -eq 0 ]; then
  pids="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true)"
  if [ -n "${pids:-}" ]; then
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 0.3
    pids2="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true)"
    if [ -n "${pids2:-}" ]; then
      # shellcheck disable=SC2086
      kill -9 $pids2 2>/dev/null || true
    fi
    echo "Stopped process(es) listening on port $PORT"
    stopped=1
  fi
fi

if [ "$stopped" -eq 0 ]; then
  echo "No running broker found (no PID file and nothing listening on port $PORT)"
fi
