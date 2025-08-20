/*!
Copyright (C) Luca Schnellmann, 2025

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

// eslint-disable-next-line n/no-unsupported-features/node-builtins
import type {DatabaseSync} from 'node:sqlite';

import {
	inject,
	type Api,
	type ApiOptions,
	type InternalApiOptions,
} from './injectable-api.js';
import {migrate} from './migration.js';
import {Asset, ImageAsset, PdfAsset} from './models/asset.js';
import {Initiative} from './models/initiative.js';
import {Login} from './models/login.js';
import {Organisation} from './models/organisation.js';
import {Person} from './models/person.js';
import {Session} from './models/session.js';

export type {Api, ApiOptions} from './injectable-api.js';
export type {Asset, ImageAsset, PdfAsset} from './models/asset.js';
export type {Initiative, InitiativeJson} from './models/initiative.js';
export type {Login, LoginJson} from './models/login.js';
export type {Organisation, OrganisationJson} from './models/organisation.js';
export type {Person, PersonJson} from './models/person.js';
export type {Session} from './models/session.js';
export * as utilities from './utilities.js';
export * from './error.js';
export {migrate} from './migration.js';

function initDatabase(database: DatabaseSync) {
	database.exec(`
		PRAGMA journal_mode=WAL;
		PRAGMA foreign_keys=ON;

		CREATE TABLE IF NOT EXISTS logins (
			userId TEXT PRIMARY KEY,
			username TEXT NOT NULL UNIQUE,
			passwordHash TEXT NOT NULL,
			createdAt INTEGER NOT NULL,
			updatedAt INTEGER NOT NULL,
			isAdmin BOOLEAN NOT NULL CHECK (isAdmin IN (0, 1))
		);

		CREATE TABLE IF NOT EXISTS sessions (
			sessionId TEXT PRIMARY KEY,
			createdAt INTEGER NOT NULL,
			userId TEXT NOT NULL,
			expires INTEGER NOT NULL,
			FOREIGN KEY(userId) REFERENCES logins(userId) ON DELETE CASCADE
		);

		CREATE TABLE IF NOT EXISTS people (
			id TEXT PRIMARY KEY,
			slug TEXT NOT NULL,
			name TEXT NOT NULL,
			owner TEXT NOT NULL,
			createdAt INTEGER NOT NULL,
			updatedAt INTEGER NOT NULL,
			FOREIGN KEY(owner) REFERENCES logins(userId) ON DELETE CASCADE,
			UNIQUE (slug, owner)
		);

		CREATE TABLE IF NOT EXISTS initiatives (
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

		CREATE TABLE IF NOT EXISTS organisations (
			id TEXT PRIMARY KEY,
			slug TEXT NOT NULL UNIQUE,
			name TEXT NOT NULL,
			image TEXT,
			website TEXT,
			createdAt INTEGER NOT NULL,
			updatedAt INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS signatures (
			personId TEXT NOT NULL,
			initiativeId TEXT NOT NULL,
			createdAt INTEGER NOT NULL,
			PRIMARY KEY (personId, initiativeId),
			FOREIGN KEY(personId) REFERENCES people(id) ON DELETE CASCADE,
			FOREIGN KEY(initiativeId) REFERENCES initiatives(id) ON DELETE CASCADE
		);

		CREATE TABLE IF NOT EXISTS initiativeOrganisations (
			initiativeId TEXT NOT NULL,
			organisationId TEXT NOT NULL,
			createdAt INTEGER NOT NULL,
			PRIMARY KEY (initiativeId, organisationId),
			FOREIGN KEY(organisationId) REFERENCES organisations(id) ON DELETE CASCADE,
			FOREIGN KEY(initiativeId) REFERENCES initiatives(id) ON DELETE CASCADE
		);
	`);
}

function normaliseDirectoryUrl(directory: URL) {
	if (!directory.href.endsWith('/')) {
		return new URL(directory.href + '/');
	}

	return directory;
}

export async function createApi(options: ApiOptions): Promise<Api> {
	initDatabase(options.database);

	const {database, assetDirectory, dataDirectory, fileSizeLimit} = options;

	const internalApiOptions: InternalApiOptions = {
		database,
		dataDirectory: normaliseDirectoryUrl(dataDirectory),
		assetDirectory: normaliseDirectoryUrl(assetDirectory),
		fileSizeLimit: fileSizeLimit,
		// Cyclical dependency
		// They don't need to access each other during creation
		Initiative: undefined!,
		Asset: undefined!,
		ImageAsset: undefined!,
		PdfAsset: undefined!,
		Organisation: undefined!,
		Login: undefined!,
		Session: undefined!,
		Person: undefined!,
	};

	const InitiativeInjected = inject(Initiative, internalApiOptions);
	const AssetInjected = inject(Asset, internalApiOptions);
	const ImageAssetInjected = inject(ImageAsset, internalApiOptions);
	const PdfAssetInjected = inject(PdfAsset, internalApiOptions);
	const OrganisationInjected = inject(Organisation, internalApiOptions);
	const LoginInjected = inject(Login, internalApiOptions);
	const SessionInjected = inject(Session, internalApiOptions);
	const PersonInjected = inject(Person, internalApiOptions);

	// @ts-expect-error They depend on each other cyclically
	internalApiOptions.Initiative = InitiativeInjected;
	// @ts-expect-error They are readonly, but that is only important afterwards
	internalApiOptions.Asset = AssetInjected;
	// @ts-expect-error Same as above
	internalApiOptions.ImageAsset = ImageAssetInjected;
	// @ts-expect-error Same as above
	internalApiOptions.PdfAsset = PdfAssetInjected;
	// @ts-expect-error Same as above
	internalApiOptions.Organisation = OrganisationInjected;
	// @ts-expect-error Same as above
	internalApiOptions.Login = LoginInjected;
	// @ts-expect-error Same as above
	internalApiOptions.Session = SessionInjected;
	// @ts-expect-error Same as above
	internalApiOptions.Person = PersonInjected;

	await migrate(internalApiOptions);

	return {
		Initiative: InitiativeInjected,
		Asset: AssetInjected,
		ImageAsset: ImageAssetInjected,
		PdfAsset: PdfAssetInjected,
		Organisation: OrganisationInjected,
		Login: LoginInjected,
		Session: SessionInjected,
		Person: PersonInjected,
	} as const;
}
