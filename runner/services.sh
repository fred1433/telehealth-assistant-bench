#!/bin/bash
# start|stop the bench services (MySQL 3417, Redis 6417), 127.0.0.1 only.
R=/private/tmp/thb-adaptive
case "$1" in
  start)
    if ! [ -S $R/mysql/mysql.sock ]; then
      nohup /opt/homebrew/opt/mysql@8.4/bin/mysqld --defaults-file=$R/mysql/my.cnf > $R/mysql/stdout.log 2>&1 &
    fi
    if ! /opt/homebrew/bin/redis-cli -p 6417 ping >/dev/null 2>&1; then
      nohup /opt/homebrew/bin/redis-server $R/redis/redis.conf > /dev/null 2>&1 &
    fi
    for i in $(seq 1 60); do
      /opt/homebrew/opt/mysql@8.4/bin/mysqladmin -uroot -h127.0.0.1 -P3417 ping >/dev/null 2>&1 && break; sleep 0.5; done
    /opt/homebrew/opt/mysql@8.4/bin/mysqladmin -uroot -h127.0.0.1 -P3417 ping; /opt/homebrew/bin/redis-cli -p 6417 ping ;;
  stop)
    /opt/homebrew/opt/mysql@8.4/bin/mysqladmin -uroot -h127.0.0.1 -P3417 shutdown 2>/dev/null
    /opt/homebrew/bin/redis-cli -p 6417 shutdown nosave 2>/dev/null
    echo stopped ;;
esac
