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

import {randomBytes, randomUUID} from 'node:crypto';
import {readdir, unlink} from 'node:fs/promises';
import {stdin, stdout} from 'node:process';
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import {createInterface} from 'node:readline/promises';
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';

import {generatePassword} from '@lusc/util/generate-password';

import {scrypt} from './promisified.ts';
import {dataDirectory, imageOutDirectory, pdfOutDirectory} from './uploads.ts';

export const database = new DatabaseSync(
	fileURLToPath(new URL('initiative-tracker.db', dataDirectory)),
);

const {
	values: {'create-login': shouldCreateLogin},
} = parseArgs({
	options: {
		'create-login': {
			type: 'boolean',
			short: 'c',
			default: false,
		},
	},
});

database.exec('PRAGMA journal_mode = WAL;');

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
	`,
);

database
	.prepare('DELETE FROM sessions WHERE expires < :expires')
	.run({expires: Date.now()});

const imageRows = database
	.prepare(
		'SELECT image FROM initiatives UNION SELECT image FROM organisations',
	)
	.all() as Array<{image: string | null}>;

const images = new Set(imageRows.map(image => image.image));
// eslint-disable-next-line security/detect-non-literal-fs-filename
const diskImages = await readdir(imageOutDirectory);

for (const diskImage of diskImages) {
	if (!images.has(diskImage)) {
		// eslint-disable-next-line security/detect-non-literal-fs-filename
		await unlink(new URL(diskImage, imageOutDirectory));
	}
}

const pdfRows = database.prepare('SELECT pdf FROM initiatives').all() as Array<{
	pdf: string;
}>;
const pdf = new Set(pdfRows.map(pdf => pdf.pdf));
// eslint-disable-next-line security/detect-non-literal-fs-filename
const diskPdfs = await readdir(pdfOutDirectory);

for (const diskPdf of diskPdfs) {
	if (!pdf.has(diskPdf)) {
		// eslint-disable-next-line security/detect-non-literal-fs-filename
		await unlink(new URL(diskPdf, pdfOutDirectory));
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
		.prepare(
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
