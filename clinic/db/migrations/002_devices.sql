-- 2026-05-18 push notification devices (Android app via FCM).
CREATE TABLE devices (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL,
  fcm_token VARCHAR(255) NOT NULL UNIQUE,
  platform ENUM('android','web') NOT NULL DEFAULT 'android',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);
