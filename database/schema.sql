-- University Fleet Management System: database schema
-- Compatible with MySQL 8.0.16+ and MariaDB 10.5+ (CHECK constraints are enforced).
-- Run with:  npm run db:init --prefix backend   (add -- --reset to drop and rebuild all tables)

CREATE DATABASE IF NOT EXISTS fleet_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fleet_db;

CREATE TABLE IF NOT EXISTS users (
    user_id        INT AUTO_INCREMENT PRIMARY KEY,
    name           VARCHAR(100) NOT NULL,
    email          VARCHAR(100) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    role           ENUM('Admin','Driver') NOT NULL,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vehicles (
    vehicle_id           INT AUTO_INCREMENT PRIMARY KEY,
    plate_number         VARCHAR(20)  NOT NULL UNIQUE,
    model                VARCHAR(100) NOT NULL,
    initial_odometer     DECIMAL(10,2) NOT NULL DEFAULT 0,
    current_odometer     DECIMAL(10,2) NOT NULL DEFAULT 0,
    service_interval_km  INT NOT NULL DEFAULT 5000,
    status               ENUM('Available','In Trip','Maintenance') NOT NULL DEFAULT 'Available',
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_vehicle_initial_odo  CHECK (initial_odometer >= 0),
    CONSTRAINT chk_vehicle_current_odo  CHECK (current_odometer >= 0),
    CONSTRAINT chk_vehicle_interval     CHECK (service_interval_km > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trips (
    trip_id         INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id      INT NOT NULL,
    driver_id       INT NOT NULL,
    destination     VARCHAR(255) NOT NULL,
    status          ENUM('Pending','Approved','Active','Completed','Cancelled') NOT NULL DEFAULT 'Pending',
    start_time      DATETIME NULL,
    end_time        DATETIME NULL,
    start_odometer  DECIMAL(10,2) NULL,
    final_odometer  DECIMAL(10,2) NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_trip_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id),
    CONSTRAINT fk_trip_driver  FOREIGN KEY (driver_id)  REFERENCES users(user_id),
    CONSTRAINT chk_trip_odo    CHECK (final_odometer IS NULL OR start_odometer IS NULL OR final_odometer >= start_odometer),
    INDEX idx_trip_status (status),
    INDEX idx_trip_driver (driver_id, status),
    INDEX idx_trip_vehicle (vehicle_id, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS location_history (
    location_id  INT AUTO_INCREMENT PRIMARY KEY,
    trip_id      INT NOT NULL,
    latitude     DECIMAL(10,8) NOT NULL,
    longitude    DECIMAL(11,8) NOT NULL,
    timestamp    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_loc_trip FOREIGN KEY (trip_id) REFERENCES trips(trip_id),
    CONSTRAINT chk_loc_lat CHECK (latitude  BETWEEN -90  AND 90),
    CONSTRAINT chk_loc_lng CHECK (longitude BETWEEN -180 AND 180),
    INDEX idx_loc_trip_time (trip_id, timestamp)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS maintenance_records (
    record_id            INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id           INT NOT NULL,
    service_date         DATE NOT NULL,
    odometer_at_service  DECIMAL(10,2) NOT NULL,
    details              TEXT NULL,
    created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rec_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id),
    CONSTRAINT chk_rec_odo CHECK (odometer_at_service >= 0),
    INDEX idx_rec_vehicle (vehicle_id, service_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS maintenance_alerts (
    alert_id     INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id   INT NOT NULL,
    alert_level  ENUM('Warning','Overdue') NOT NULL,
    status       ENUM('Active','Resolved') NOT NULL DEFAULT 'Active',
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at  TIMESTAMP NULL,
    CONSTRAINT fk_alert_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id),
    INDEX idx_alert_status (status, vehicle_id)
) ENGINE=InnoDB;
