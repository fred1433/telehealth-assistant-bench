// Central access to configuration. Values are read at call time so tests can override them.
function read(name: string, fallback: string): string {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

export const env = {
  get databaseUrl() { return read('DATABASE_URL', 'mysql://clinic:clinic@127.0.0.1:3306/clinic'); },
  get redisUrl() { return read('REDIS_URL', 'redis://127.0.0.1:6379/0'); },
  get appBaseUrl() { return read('APP_BASE_URL', 'http://localhost:3000'); },
  get mailTransport() { return read('MAIL_TRANSPORT', 'smtp') as 'smtp' | 'memory'; },
  get smtpHost() { return read('SMTP_HOST', '127.0.0.1'); },
  get smtpPort() { return Number(read('SMTP_PORT', '1025')); },
  get mailFrom() { return read('MAIL_FROM', 'no-reply@clinic.example'); },
  get pushTransport() { return read('PUSH_TRANSPORT', 'fcm') as 'fcm' | 'memory'; },
  get fcmEndpoint() { return read('FCM_ENDPOINT', 'https://fcm.googleapis.com'); },
  get fcmProject() { return read('FCM_PROJECT', 'clinic-dev'); },
  get fcmAccessToken() { return read('FCM_ACCESS_TOKEN', ''); },
  get logFile() { return process.env.LOG_FILE || undefined; },
};
