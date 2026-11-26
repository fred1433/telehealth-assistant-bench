#!/bin/bash
# start|stop the grading environment: collectors (SMTP 2517, FCM 9517) and Apache (8417). 127.0.0.1 only.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
G=/private/tmp/thb-adaptive/grade
mkdir -p "$G/run"
case "$1" in
  start)
    sed -e "s#__GRADE_DIR__#$G#g" -e "s#__APACHE_PORT__#8417#g" -e "s#__APP_PORT__#3517#g" "$HERE/apache.conf.tmpl" > "$G/httpd.conf"
    if ! [ -f "$G/collectors.pid" ] || ! kill -0 "$(cat "$G/collectors.pid")" 2>/dev/null; then
      nohup "$HERE/node_modules/.bin/tsx" "$HERE/collectors.ts" > "$G/collectors.log" 2>&1 &
      echo $! > "$G/collectors.pid"
    fi
    if ! [ -f "$G/httpd.pid" ] || ! kill -0 "$(cat "$G/httpd.pid")" 2>/dev/null; then
      /usr/sbin/httpd -f "$G/httpd.conf" -k start
    fi
    sleep 1; lsof -nP -iTCP -sTCP:LISTEN | grep -E ':(8417|2517|9517) ' | awk '{print $1, $9}' ;;
  stop)
    [ -f "$G/httpd.pid" ] && /usr/sbin/httpd -f "$G/httpd.conf" -k stop
    [ -f "$G/collectors.pid" ] && kill "$(cat "$G/collectors.pid")" 2>/dev/null && rm -f "$G/collectors.pid"
    echo stopped ;;
esac
