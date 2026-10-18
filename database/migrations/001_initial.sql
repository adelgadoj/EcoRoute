-- EcoRoute · migración inicial (PostgreSQL 16 + PostGIS)
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,            -- bcrypt, nunca la clave en texto
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE memberships (
    organization_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    role TEXT NOT NULL CHECK (role IN ('owner','admin','dispatcher','driver')),
    PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    code TEXT NOT NULL,
    plate TEXT NOT NULL,
    capacity_kg NUMERIC(10,2),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, code),
    UNIQUE (organization_id, plate),
    UNIQUE (organization_id, id)
);

CREATE TABLE containers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    code TEXT NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    address TEXT,
    container_type TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, code),
    UNIQUE (organization_id, id)
);
CREATE INDEX containers_location_idx ON containers USING GIST (location);

CREATE TABLE routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    vehicle_id UUID NOT NULL,
    driver_id UUID NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planned'
        CHECK (status IN ('planned','assigned','active','paused','completed','cancelled')),
    planned_distance_m INTEGER,
    planned_duration_s INTEGER,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (organization_id, vehicle_id) REFERENCES vehicles(organization_id, id),
    FOREIGN KEY (organization_id, driver_id) REFERENCES memberships(organization_id, user_id),
    UNIQUE (organization_id, id)
);

CREATE TABLE route_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    route_id UUID NOT NULL,
    container_id UUID NOT NULL,
    sequence INTEGER NOT NULL CHECK (sequence > 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','collected','skipped')),
    arrived_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    FOREIGN KEY (organization_id, route_id) REFERENCES routes(organization_id, id),
    FOREIGN KEY (organization_id, container_id) REFERENCES containers(organization_id, id),
    UNIQUE (route_id, sequence),
    UNIQUE (route_id, container_id),
    UNIQUE (organization_id, id)            -- CORRECCIÓN: faltaba y rompía collection_events
);

CREATE TABLE gps_positions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    route_id UUID NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    accuracy_m REAL,
    speed_mps REAL,
    recorded_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (organization_id, route_id) REFERENCES routes(organization_id, id)
);
CREATE INDEX gps_route_time_idx ON gps_positions (route_id, recorded_at DESC);
CREATE INDEX gps_location_idx ON gps_positions USING GIST (location);

CREATE TABLE collection_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    route_stop_id UUID NOT NULL,
    driver_id UUID NOT NULL,
    result TEXT NOT NULL CHECK (result IN ('collected','unable_to_collect')),
    reason TEXT,
    recorded_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    idempotency_key UUID NOT NULL UNIQUE,   -- evita doble pulsación / reenvío offline
    FOREIGN KEY (organization_id, driver_id) REFERENCES memberships(organization_id, user_id),
    FOREIGN KEY (organization_id, route_stop_id) REFERENCES route_stops(organization_id, id)
);

CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    route_id UUID NOT NULL,
    driver_id UUID NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    FOREIGN KEY (organization_id, route_id) REFERENCES routes(organization_id, id),
    FOREIGN KEY (organization_id, driver_id) REFERENCES memberships(organization_id, user_id)
);
