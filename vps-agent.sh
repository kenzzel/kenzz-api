#!/usr/bin/env bash
# Lightweight Linux VPS metrics sender. Requires: bash, curl, awk, df, free, hostname.
set -euo pipefail
: "${KENZZ_API_URL:?Set KENZZ_API_URL, e.g. https://your-domain.vercel.app}"
: "${VPS_AGENT_TOKEN:?Set VPS_AGENT_TOKEN to the same Vercel secret}"
read -r IDLE1 TOTAL1 < <(awk '/^cpu / {idle=$5+$6; total=0; for(i=2;i<=NF;i++) total+=$i; print idle,total}' /proc/stat)
sleep 1
read -r IDLE2 TOTAL2 < <(awk '/^cpu / {idle=$5+$6; total=0; for(i=2;i<=NF;i++) total+=$i; print idle,total}' /proc/stat)
CPU=$(awk -v i1="$IDLE1" -v t1="$TOTAL1" -v i2="$IDLE2" -v t2="$TOTAL2" 'BEGIN {dt=t2-t1; if(dt>0) printf "%.2f",100*(1-(i2-i1)/dt); else print "0"}')
read -r RAM_USED RAM_TOTAL < <(free -m | awk '/Mem:/ {print $3, $2}')
DISK=$(df -P / | awk 'NR==2 {gsub("%","",$5); print $5}')
UPTIME=$(awk '{print int($1)}' /proc/uptime)
JSON=$(printf '{"hostname":"%s","cpu_percent":%s,"ram_used_mb":%s,"ram_total_mb":%s,"disk_used_percent":%s,"uptime_seconds":%s}' "$(hostname)" "$CPU" "$RAM_USED" "$RAM_TOTAL" "$DISK" "$UPTIME")
curl -fsS -X POST "${KENZZ_API_URL%/}/api/monitor/metrics" \
  -H "Authorization: Bearer ${VPS_AGENT_TOKEN}" -H 'Content-Type: application/json' \
  --data "$JSON"
echo
