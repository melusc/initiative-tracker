PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

CREATE TABLE logins_new (
	userId TEXT PRIMARY KEY,
	username TEXT NOT NULL UNIQUE,
	passwordHash TEXT NOT NULL,
	createdAt INTEGER NOT NULL,
	updatedAt INTEGER NOT NULL,
	isAdmin BOOLEAN NOT NULL CHECK (isAdmin IN (0, 1))
);

ALTER TABLE logins ADD COLUMN createdAt INTEGER;
ALTER TABLE logins ADD COLUMN updatedAt INTEGER;

UPDATE logins
SET createdAt = $$NOW$$,
	updatedAt = $$NOW$$;

INSERT INTO logins_new
	(userId, username, passwordHash,
	createdAt, updatedAt, isAdmin)
SELECT
	userId, username, passwordHash,
	createdAt, updatedAt, isAdmin
FROM logins;

DROP TABLE logins;
ALTER TABLE logins_new RENAME TO logins;

CREATE TABLE sessions_new (
	sessionId TEXT PRIMARY KEY,
	createdAt INTEGER NOT NULL,
	userId TEXT NOT NULL,
	expires INTEGER NOT NULL,
	FOREIGN KEY(userId) REFERENCES logins(userId) ON DELETE CASCADE
);

ALTER TABLE sessions ADD COLUMN createdAt INTEGER;

UPDATE sessions
SET createdAt = expires - (7 * 24 * 60 * 60 * 1000);

INSERT INTO sessions_new
	(sessionId, createdAt, userId, expires)
SELECT sessionId, createdAt, userId, expires
FROM sessions;

DROP TABLE sessions;
ALTER TABLE sessions_new RENAME TO sessions;

CREATE TABLE people_new (
	id TEXT PRIMARY KEY,
	slug TEXT NOT NULL,
	name TEXT NOT NULL,
	owner TEXT NOT NULL,
	createdAt INTEGER NOT NULL,
	updatedAt INTEGER NOT NULL,
	FOREIGN KEY(owner) REFERENCES logins(userId) ON DELETE CASCADE,
	UNIQUE (slug, owner)
);

ALTER TABLE people ADD COLUMN createdAt INTEGER;
ALTER TABLE people ADD COLUMN updatedAt INTEGER;

UPDATE people
SET createdAt = $$NOW$$,
	updatedAt = $$NOW$$;

INSERT INTO people_new
	(id, slug, name, owner, createdAt, updatedAt)
SELECT id, slug, name, owner, createdAt, updatedAt
FROM people;

DROP TABLE people;
ALTER TABLE people_new RENAME TO people;

CREATE TABLE initiatives_new (
	id TEXT PRIMARY KEY,
	slug TEXT NOT NULL UNIQUE,
	shortName TEXT NOT NULL,
	fullName TEXT NOT NULL,
	website TEXT,
	pdf TEXT NOT NULL,
	image TEXT,
	deadline TEXT,
	initiatedDate TEXT,
	updatedAt INTEGER NOT NULL,
	createdAt INTEGER NOT NULL
);

ALTER TABLE initiatives ADD COLUMN createdAt INTEGER;
ALTER TABLE initiatives ADD COLUMN updatedAt INTEGER;
ALTER TABLE initiatives ADD COLUMN initiatedDate TEXT;

UPDATE initiatives
SET createdAt = $$NOW$$,
	updatedAt = $$NOW$$;

INSERT INTO initiatives_new
	(id, slug, shortName, fullName, website, pdf,
	image, deadline, initiatedDate, updatedAt, createdAt)
SELECT
	id, slug, shortName, fullName, website, pdf,
	image, deadline, initiatedDate, updatedAt, createdAt
FROM initiatives;

DROP TABLE initiatives;
ALTER TABLE initiatives_new RENAME TO initiatives;

CREATE TABLE organisations_new (
	id TEXT PRIMARY KEY,
	slug TEXT NOT NULL UNIQUE,
	name TEXT NOT NULL,
	image TEXT,
	website TEXT,
	createdAt INTEGER NOT NULL,
	updatedAt INTEGER NOT NULL
);

ALTER TABLE organisations ADD COLUMN createdAt INTEGER;
ALTER TABLE organisations ADD COLUMN updatedAt INTEGER;

UPDATE organisations
SET createdAt = $$NOW$$,
	updatedAt = $$NOW$$;

INSERT INTO organisations_new
	(id, slug, name, image,
	website, createdAt, updatedAt)
SELECT
	id, slug, name, image,
	website, createdAt, updatedAt
FROM organisations;

DROP TABLE organisations;
ALTER TABLE organisations_new RENAME TO organisations;

CREATE TABLE signatures_new (
	personId TEXT NOT NULL,
	initiativeId TEXT NOT NULL,
	createdAt INTEGER NOT NULL,
	PRIMARY KEY (personId, initiativeId),
	FOREIGN KEY(personId) REFERENCES people(id) ON DELETE CASCADE,
	FOREIGN KEY(initiativeId) REFERENCES initiatives(id) ON DELETE CASCADE
);

ALTER TABLE signatures ADD COLUMN createdAt INTEGER;

UPDATE signatures
SET createdAt = $$NOW$$;

INSERT INTO signatures_new
	(personId, initiativeId, createdAt)
SELECT
	personId, initiativeId, createdAt
FROM signatures;

DROP TABLE signatures;
ALTER TABLE signatures_new RENAME TO signatures;

CREATE TABLE initiativeOrganisations_new (
	initiativeId TEXT NOT NULL,
	organisationId TEXT NOT NULL,
	createdAt INTEGER NOT NULL,
	PRIMARY KEY (initiativeId, organisationId),
	FOREIGN KEY(organisationId) REFERENCES organisations(id) ON DELETE CASCADE,
	FOREIGN KEY(initiativeId) REFERENCES initiatives(id) ON DELETE CASCADE
);

ALTER TABLE initiativeOrganisations ADD COLUMN createdAt INTEGER;

UPDATE initiativeOrganisations
SET createdAt = $$NOW$$;

INSERT INTO initiativeOrganisations_new
	(initiativeId, organisationId, createdAt)
SELECT
	initiativeId, organisationId, createdAt
FROM initiativeOrganisations;

DROP TABLE initiativeOrganisations;
ALTER TABLE initiativeOrganisations_new RENAME TO initiativeOrganisations;



COMMIT;
PRAGMA foreign_keys=ON;
