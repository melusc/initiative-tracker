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

import {stdin, stdout} from 'node:process';
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import {createInterface} from 'node:readline/promises';
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';

import {createApi, utilities} from '@lusc/initiative-tracker-api';
import {generatePassword} from '@lusc/util/generate-password';

import {cleanupBeforeExit} from './cleanup.ts';
import {assetDirectory, dataDirectory, fileSizeLimit} from './uploads.ts';

const database = new DatabaseSync(
	fileURLToPath(new URL('initiative-tracker.db', dataDirectory)),
);

export const api = createApi({
	fileSizeLimit,
	assetDirectory,
	database,
});

await utilities.removeUnusedAssets(assetDirectory, api);
api.Session.removeExpired();

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

	await api.Login.create(username, password, isAdmin);

	console.log(
		'Created %s "%s", password %s',
		isAdmin ? 'admin account' : 'account',
		username,
		password,
	);
}

cleanupBeforeExit(() => {
	database.close();
});
