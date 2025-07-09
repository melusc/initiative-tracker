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
import {Asset, ImageAsset, PdfAsset} from './models/asset.js';
import {Initiative} from './models/initiative.js';

function initDatabase(database: DatabaseSync) {
	database.exec('PRAGMA journal_mode=WAL;');

	database.exec(`
		CREATE TABLE IF NOT EXISTS logins (
				userId TEXT PRIMARY KEY,
				username TEXT NOT NULL UNIQUE,
				passwordHash BLOB NOT NULL,
				passwordSalt BLOB NOT NULL,
				isAdmin BOOLEAN NOT NULL CHECK (isAdmin IN (0, 1))
		);

		CREATE TABLE IF NOT EXISTS sessions (
				sessionId TEXT PRIMARY KEY,
				userId TEXT NOT NULL,
				expires INTEGER NOT NULL,
				FOREIGN KEY(userId) REFERENCES logins(userId) ON DELETE CASCADE
		);

		CREATE TABLE IF NOT EXISTS people (
				id TEXT,
				name TEXT NOT NULL,
				owner TEXT NOT NULL,
				PRIMARY KEY (id, owner),
				FOREIGN KEY(owner) REFERENCES logins(userId) ON DELETE CASCADE
		);

		CREATE TABLE IF NOT EXISTS initiatives (
				id TEXT PRIMARY KEY,
				shortName TEXT NOT NULL,
				fullName TEXT NOT NULL,
				website TEXT,
				pdf TEXT NOT NULL,
				image TEXT,
				deadline TEXT
		);

		CREATE TABLE IF NOT EXISTS organisations (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				image TEXT,
				website TEXT
		);

		CREATE TABLE IF NOT EXISTS signatures (
				personId TEXT NOT NULL,
				initiativeId TEXT NOT NULL,
				PRIMARY KEY (personId, initiativeId),
				FOREIGN KEY(personId) REFERENCES people(id) ON DELETE CASCADE,
				FOREIGN KEY(initiativeId) REFERENCES initiatives(id) ON DELETE CASCADE
		);

		CREATE TABLE IF NOT EXISTS initiativeOrganisations (
				initiativeId TEXT NOT NULL,
				organisationId TEXT NOT NULL,
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

export function createApi(options: ApiOptions): Api {
	initDatabase(options.database);

	const {database, assetDirectory, fileSizeLimit} = options;

	const internalApiOptions: InternalApiOptions = {
		database,
		assetDirectory: normaliseDirectoryUrl(assetDirectory),
		fileSizeLimit: fileSizeLimit,
		// Cyclical dependency
		// They don't need to access each other during creation
		Initiative: undefined!,
		Asset: undefined!,
		ImageAsset: undefined!,
		PdfAsset: undefined!,
	};

	const InitiativeInjected = inject(Initiative, internalApiOptions);
	const AssetInjected = inject(Asset, internalApiOptions);
	const ImageAssetInjected = inject(ImageAsset, internalApiOptions);
	const PdfAssetInjected = inject(PdfAsset, internalApiOptions);

	// @ts-expect-error They depend on each other cyclically
	internalApiOptions.Initiative = InitiativeInjected;
	// @ts-expect-error They are readonly, but that is only important afterwards
	internalApiOptions.Asset = AssetInjected;
	// @ts-expect-error Same as above
	internalApiOptions.ImageAsset = ImageAssetInjected;
	// @ts-expect-error Same as above
	internalApiOptions.PdfAsset = PdfAssetInjected;

	return {
		Initiative: InitiativeInjected,
		Asset: AssetInjected,
		ImageAsset: ImageAssetInjected,
		PdfAsset: PdfAssetInjected,
	} as const;
}
