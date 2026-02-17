-- ============================================================
-- VSCPI Weather Station — MySQL Database Schema
-- ============================================================
-- Run this file to set up the database:
--   mysql -u root < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS weather_station
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE weather_station;

-- ============================================================
-- Table: weather_readings
-- Stores every reading received from the SEN0186 sensor
-- ============================================================
CREATE TABLE IF NOT EXISTS weather_readings (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  recorded_at     DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  -- Wind
  wind_direction  SMALLINT       NOT NULL COMMENT 'Degrees 0-360',
  wind_speed_mph  DECIMAL(5,2)   NOT NULL COMMENT '1-minute average, mph',
  wind_speed_ms   DECIMAL(5,2)   NOT NULL COMMENT '1-minute average, m/s',
  wind_gust_mph   DECIMAL(5,2)   NOT NULL COMMENT '5-minute max, mph',
  wind_gust_ms    DECIMAL(5,2)   NOT NULL COMMENT '5-minute max, m/s',

  -- Temperature
  temp_f          DECIMAL(5,1)   NOT NULL COMMENT 'Fahrenheit',
  temp_c          DECIMAL(5,1)   NOT NULL COMMENT 'Celsius',

  -- Precipitation
  rain_1h_in      DECIMAL(6,2)   NOT NULL COMMENT 'Rainfall last 1 hour, inches',
  rain_1h_mm      DECIMAL(6,1)   NOT NULL COMMENT 'Rainfall last 1 hour, mm',
  rain_24h_in     DECIMAL(6,2)   NOT NULL COMMENT 'Rainfall last 24 hours, inches',
  rain_24h_mm     DECIMAL(6,1)   NOT NULL COMMENT 'Rainfall last 24 hours, mm',

  -- Atmosphere
  humidity        TINYINT        NOT NULL COMMENT 'Relative humidity, %',
  pressure_mbar   DECIMAL(7,1)   NOT NULL COMMENT 'Barometric pressure, mbar',
  pressure_inhg   DECIMAL(6,2)   NOT NULL COMMENT 'Barometric pressure, inHg',

  -- Raw data for debugging
  raw_string      VARCHAR(64)    NOT NULL COMMENT 'Original APRS string from sensor',
  checksum        VARCHAR(8)     NOT NULL COMMENT 'Checksum from packet',

  INDEX idx_recorded_at (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================================
-- Table: admin_users
-- Admin accounts for the dashboard settings panel
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username        VARCHAR(64)    NOT NULL UNIQUE,
  -- Password stored as bcrypt hash (never plain text)
  password_hash   VARCHAR(255)   NOT NULL,
  created_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login      DATETIME       NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================================
-- Table: dashboard_config
-- Controls which cards are visible on the public dashboard
-- ============================================================
CREATE TABLE IF NOT EXISTS dashboard_config (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  card_key        VARCHAR(64)    NOT NULL UNIQUE COMMENT 'Unique identifier for each card',
  card_label      VARCHAR(128)   NOT NULL COMMENT 'Human-readable name shown in admin panel',
  is_visible      TINYINT(1)     NOT NULL DEFAULT 1 COMMENT '1 = shown, 0 = hidden',
  display_order   TINYINT        NOT NULL DEFAULT 0 COMMENT 'Order on dashboard (lower = first)',
  updated_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================================
-- Seed Data
-- ============================================================

-- Default admin user: username=admin, password=admin123
-- (Change this immediately after first login!)
-- Hash generated with: bcrypt('admin123', 12)
INSERT INTO admin_users (username, password_hash) VALUES
  ('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMaJqetVHjhFVFGXMGFBfHGiWy');


-- Default dashboard cards (all visible)
INSERT INTO dashboard_config (card_key, card_label, is_visible, display_order) VALUES
  ('temperature',    'Temperature',              1, 1),
  ('humidity',       'Humidity',                 1, 2),
  ('wind_direction', 'Wind Direction (Compass)',  1, 3),
  ('wind_speed',     'Wind Speed',               1, 4),
  ('wind_gust',      'Wind Gust',                1, 5),
  ('pressure',       'Barometric Pressure',      1, 6),
  ('rain_1h',        'Rainfall (Last Hour)',      1, 7),
  ('rain_24h',       'Rainfall (Last 24 Hours)', 1, 8);


-- Sample weather readings for development/testing
INSERT INTO weather_readings (
  wind_direction, wind_speed_mph, wind_speed_ms, wind_gust_mph, wind_gust_ms,
  temp_f, temp_c, rain_1h_in, rain_1h_mm, rain_24h_in, rain_24h_mm,
  humidity, pressure_mbar, pressure_inhg, raw_string, checksum
) VALUES
  (90,  2.0, 0.89, 7.0, 3.13, 74.0, 23.3, 0.10, 2.5, 0.10, 2.5, 46, 996.0, 29.41, 'c090s002g007t074r010p010h46b09960*30', '30'),
  (135, 0.0, 0.00, 5.0, 2.24, 73.0, 22.8, 0.00, 0.0, 0.00, 0.0, 45, 996.0, 29.41, 'c135s000g005t073r000p000h45b09960*3A', '3A'),
  (180, 3.0, 1.34, 8.0, 3.58, 72.0, 22.2, 0.00, 0.0, 0.00, 0.0, 48, 995.5, 29.39, 'c180s003g008t072r000p000h48b09955*2F', '2F'),
  (270, 5.0, 2.24, 12.0, 5.36, 71.0, 21.7, 0.00, 0.0, 0.00, 0.0, 50, 994.8, 29.37, 'c270s005g012t071r000p000h50b09948*1C', '1C'),
  (315, 1.0, 0.45, 3.0, 1.34, 75.0, 23.9, 0.05, 1.3, 0.05, 1.3, 44, 997.2, 29.45, 'c315s001g003t075r005p005h44b09972*22', '22');
