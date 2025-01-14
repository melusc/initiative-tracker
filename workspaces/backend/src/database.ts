/*!
Copyright (C) 2024  Luca Schnellmann

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

import type {Buffer} from 'node:buffer';
import {randomBytes, randomUUID} from 'node:crypto';
import {readdir, unlink} from 'node:fs/promises';
import {stdin, stdout} from 'node:process';
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import {createInterface} from 'node:readline/promises';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';

import {generatePassword} from '@lusc/util/generate-password';
import Database, {type Database as DatabaseT} from 'better-sqlite3';

import {scrypt} from './promisified.ts';
import {dataDirectory, imageOutDirectory, pdfOutDirectory} from './uploads.ts';

export const database: DatabaseT = new Database(
	fileURLToPath(new URL('initiative-tracker.db', dataDirectory)),
);

const {
	values: {'create-login': shouldCreateLogin, prune: shouldPrune},
} = parseArgs({
	options: {
		'create-login': {
			type: 'boolean',
			short: 'c',
			default: false,
		},
		prune: {
			type: 'boolean',
			default: false,
		},
	},
});

database.pragma('journal_mode = WAL');
database.pragma('foreign_keys = ON');

database.exec(
	`
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
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				owner TEXT NOT NULL,
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
	`,
);

database
	.prepare<{expires: number}>('DELETE FROM sessions WHERE expires < :expires')
	.run({expires: Date.now()});

if (shouldPrune) {
	const images = new Set(
		database
			.prepare<[], {image: string | null}>(
				'SELECT image FROM initiatives UNION SELECT image FROM organisations',
			)
			.all()
			.map(image => image.image),
	);
	const diskImages = await readdir(imageOutDirectory);

	for (const diskImage of diskImages) {
		if (!images.has(diskImage)) {
			await unlink(new URL(diskImage, imageOutDirectory));
		}
	}

	const pdf = new Set(
		database
			.prepare<[], {pdf: string}>('SELECT pdf FROM initiatives')
			.all()
			.map(pdf => pdf.pdf),
	);
	const diskPdfs = await readdir(pdfOutDirectory);

	for (const diskPdf of diskPdfs) {
		if (!pdf.has(diskPdf)) {
			await unlink(new URL(diskPdf, pdfOutDirectory));
		}
	}
}

if (shouldCreateLogin) {
	const rl = createInterface({
		input: stdin,
		output: stdout,
	});

	const username = await rl.question('Username: ');
	const password = generatePassword({length: 16});
	const isAdminAnswer = await rl.question('Admin? (y/n) ');
	const isAdmin = ['y', 'yes'].includes(isAdminAnswer.trim().toLowerCase());

	rl.close();

	const salt = randomBytes(64);
	const passwordHash = await scrypt(password, salt, 64);

	database
		.prepare<{
			userId: string;
			username: string;
			passwordHash: Buffer;
			salt: Buffer;
			isAdmin: 1 | 0;
		}>(
			`
			INSERT INTO logins
				(userId, username, passwordHash, passwordSalt, isAdmin)
				values
				(:userId, :username, :passwordHash, :salt, :isAdmin);
		`,
		)
		.run({
			userId: randomUUID(),
			username,
			passwordHash,
			salt,
			isAdmin: isAdmin ? 1 : 0,
		});

	console.log(
		'Created %s "%s", password %s',
		isAdmin ? 'admin account' : 'account',
		username,
		password,
	);
}
