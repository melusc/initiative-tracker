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

import {readdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import type {InternalApiOptions} from './injectable-api.js';

type MigrationFunctionRun = (api: InternalApiOptions) => void | Promise<void>;
type MigrationFunctionShouldRun = (
	api: InternalApiOptions,
) => boolean | Promise<boolean>;

class Migration {
	private readonly path: URL;
	private _run: MigrationFunctionRun | undefined;
	private _shouldRun: MigrationFunctionShouldRun | undefined;
	public readonly id: number;
	public readonly name: string;

	constructor(filePath: URL) {
		this.path = filePath;
		const asPath = fileURLToPath(filePath);
		const basename = path.basename(asPath);
		const extension = path.extname(asPath);
		if (extension !== '.js') {
			throw new TypeError(`Migrations must be .js files, got ${basename}`);
		}

		const stem = path.basename(asPath, '.js');
		const match = /^\d+/.exec(stem);
		if (!match) {
			throw new Error(
				`Invalid migration does not match file format $id-$name.js: ${basename}`,
			);
		}

		this.id = Number.parseInt(match[0], 10);
		this.name = stem;
	}

	async _import() {
		if (this._run && this._shouldRun) {
			return;
		}

		const imported = (await import(this.path.href)) as {
			run?: MigrationFunctionRun;
			shouldRun?: MigrationFunctionShouldRun;
		};

		if (!imported.run || !imported.shouldRun) {
			throw new TypeError(
				'Migrator.run and Migrator.shouldRun must be defined.',
			);
		}

		this._run = imported.run;
		this._shouldRun = imported.shouldRun;
	}

	async shouldRun(api: InternalApiOptions) {
		await this._import();

		return this._shouldRun!(api);
	}

	async run(api: InternalApiOptions) {
		await this._import();

		console.log('Migrating %s', this.name);
		await this._run!(api);
		console.log('Done %s', this.name);
	}
}

const migrationsDirectory = new URL('migrations/', import.meta.url);

async function listMigrationsSorted(): Promise<readonly Migration[]> {
	let fileList: string[];

	try {
		// eslint-disable-next-line security/detect-non-literal-fs-filename
		fileList = await readdir(migrationsDirectory);
	} catch {
		return [];
	}

	const migrations: Migration[] = [];

	// Assert not duplicate ids exist
	const migrationIds = new Set<number>();

	for (const path of fileList) {
		if (!path.endsWith('.js')) {
			continue;
		}

		const fullPath = new URL(path, migrationsDirectory);
		const migration = new Migration(fullPath);
		migrations.push(migration);

		if (migrationIds.has(migration.id)) {
			throw new Error(`Duplicate migration id ${migration.id}.`);
		}

		migrationIds.add(migration.id);
	}

	const sortedMigrations = migrations.toSorted((a, b) => a.id - b.id);
	return sortedMigrations;
}

const allMigrationsSorted = await listMigrationsSorted();

function resolveMigrationStatePath(api: InternalApiOptions) {
	return new URL('migration-state', api.dataDirectory);
}

async function readMigrationState(api: InternalApiOptions) {
	let stateContent: string;

	try {
		// eslint-disable-next-line security/detect-non-literal-fs-filename
		stateContent = await readFile(resolveMigrationStatePath(api), 'utf8');
	} catch {
		return -1;
	}

	const id = Number.parseInt(stateContent, 10);
	if (!Number.isFinite(id)) {
		throw new TypeError('migration-state is corrupted');
	}

	return id;
}

async function writeMigrationState(id: number, api: InternalApiOptions) {
	// eslint-disable-next-line security/detect-non-literal-fs-filename
	await writeFile(resolveMigrationStatePath(api), String(id));
}

export async function migrate(api: InternalApiOptions) {
	if (allMigrationsSorted.length === 0) {
		return;
	}

	let migrationState = await readMigrationState(api);

	for (const migration of allMigrationsSorted) {
		if (migration.id <= migrationState) {
			continue;
		}

		const shouldRun = await migration.shouldRun(api);
		if (shouldRun) {
			await migration.run(api);
		}

		migrationState = migration.id;
		await writeMigrationState(migrationState, api);
	}
}
