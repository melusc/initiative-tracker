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

import {readFile} from 'node:fs/promises';

import type {InternalApiOptions} from '../injectable-api.js';

export function shouldRun(api: InternalApiOptions): boolean {
	const tableNames = api.database
		.prepare('PRAGMA table_info(logins)')
		.all() as Array<{
		name: string;
	}>;

	for (const {name} of tableNames) {
		if (name === 'createdAt' || name === 'updatedAt') {
			return false;
		}
	}

	return true;
}

export async function run(api: InternalApiOptions): Promise<void> {
	// eslint-disable-next-line security/detect-non-literal-fs-filename
	const migrationQuery = await readFile(
		new URL('001-modification-creation-date.sql', import.meta.url),
		'utf8',
	);

	const now = Date.now();

	api.database.exec(migrationQuery.replaceAll('$$NOW$$', String(now)));
}
