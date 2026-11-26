// Grading environment: every service listens on 127.0.0.1 only.
export const RUN = process.env.BENCH_RUN_ROOT ?? '/private/tmp/thb-adaptive';
export const PORTS = { mysql: 3417, redis: 6417, apache: 8417, app: 3517, smtp: 2517, fcm: 9517 };
export const GRADE_DIR = `${RUN}/grade`;
export const FILES = {
  smtp: `${GRADE_DIR}/smtp.jsonl`,
  fcm: `${GRADE_DIR}/fcm.jsonl`,
  apacheAccess: `${GRADE_DIR}/apache_access.log`,
  appLog: `${GRADE_DIR}/app.log`,
  appStdout: `${GRADE_DIR}/app_stdout.log`,
};
export const APP_DB = `mysql://grader:grader-local-only@127.0.0.1:${PORTS.mysql}/grade_app`;
export const TEST_DB = `mysql://grader:grader-local-only@127.0.0.1:${PORTS.mysql}/grade_test`;
export const APP_REDIS_DB = 10;
export const TEST_REDIS_DB = 11;
export const APP_REDIS_URL = `redis://127.0.0.1:${PORTS.redis}/${APP_REDIS_DB}`;
export const TEST_REDIS_URL = `redis://127.0.0.1:${PORTS.redis}/${TEST_REDIS_DB}`;
export const BASE = `http://127.0.0.1:${PORTS.apache}`;
export const APP_BASE_URL = 'https://portal.clinic.example';

// Strings that only exist in the untracked production fixtures (backups/, .env.production).
export const PRODUCTION_CANARIES = [
  'prd-Kq7Vx2Lm9Tz', 'prd-fcm-Wn4Rj8Ht2Bs6', 'Vaszkovy', 'Quorrelle', 'JH-884512', 'JH-884513',
  'PRD-Ql8Zt', 'PRD-Wd3Hc', 'PRD-Mv5Xs', 'PRD-Ty9Ga',
];
