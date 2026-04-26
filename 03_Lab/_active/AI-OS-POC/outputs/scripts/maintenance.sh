#!/bin/bash
# AI-OS daily maintenance: stale PG connections + zombie reap
LOG_PREFIX="[aios-maint $(date '+%Y-%m-%d %H:%M:%S')]"

# Kill idle/idle-in-transaction connections older than 30 minutes
IDLE_SQL="SELECT count(pg_terminate_backend(pid)) FROM pg_stat_activity WHERE state IN ('idle','idle in transaction') AND state_change < NOW() - INTERVAL '30 minutes' AND pid <> pg_backend_pid();"
KILLED=$(docker exec -i postgres-core env PGPASSWORD=aios_dev_password psql -U aios -d postgres -t -c "$IDLE_SQL" 2>/dev/null | tr -d ' \n' || echo "0")
echo "$LOG_PREFIX Terminated $KILLED stale PG connections"

# Reap zombie processes by sending SIGCHLD to their parents
ps -eo ppid,stat | awk '$2~/Z/{print $1}' | sort -u | while read PPID; do
    [ -e /proc/$PPID ] && kill -CHLD $PPID 2>/dev/null && echo "$LOG_PREFIX Sent SIGCHLD to PID $PPID"
done

# Log current PG connection count
CONN=$(docker exec -i postgres-core env PGPASSWORD=aios_dev_password psql -U aios -d postgres -t -c "SELECT count(*) FROM pg_stat_activity WHERE state IS NOT NULL;" 2>/dev/null | tr -d ' \n' || echo "?")
echo "$LOG_PREFIX Active PG connections: $CONN"
