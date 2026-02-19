/*!
	Copyright 2025 Luca Schnellmann <oss@lusc.ch>

	This file is part of recipe-store.

	This program is free software: you can redistribute it
	and/or modify it under the terms of the GNU General Public
	License as published by the Free Software Foundation,
	either version 3 of the License, or (at your option)
	any later version.

	This program is distributed in the hope that it will be
	useful, but WITHOUT ANY WARRANTY; without even the implied
	warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
	PURPOSE. See the GNU General Public License for more details.

	You should have received a copy of the GNU General Public
	License along with this program. If not, see <https://www.gnu.org/licenses/>.
*/

import {Buffer} from 'node:buffer';
import {randomBytes} from 'node:crypto';
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import {DatabaseSync} from 'node:sqlite';

import type {Use} from '@vitest/runner';
import {test} from 'vitest';

import {createApi} from '../src/index.js';
import type {Api} from '../src/injectable-api.js';

const parentTemporaryDirectory = new URL('.tmp/', import.meta.url);
await mkdir(parentTemporaryDirectory, {recursive: true});
await writeFile(new URL('.gitignore', parentTemporaryDirectory), '*');

type UtilityApi = Readonly<
	Api & {
		database: DatabaseSync;
	}
>;

const fixtureDirectory = new URL('fixtures/', import.meta.url);

export const sampleAssetPaths = {
	jpg: new URL('image1.jpg', fixtureDirectory),
	webp: new URL('image2.webp', fixtureDirectory),
	png: new URL('image3.png', fixtureDirectory),
	svg: new URL('image4.svg', fixtureDirectory),
	pdf: new URL('sample.pdf', fixtureDirectory),
} as const;

export async function compareFile(
	fileA: URL | Buffer,
	fileB: URL | Buffer,
): Promise<boolean> {
	if (!Buffer.isBuffer(fileA)) {
		fileA = await readFile(fileA);
	}

	if (!Buffer.isBuffer(fileB)) {
		fileB = await readFile(fileB);
	}

	return Buffer.compare(fileA, fileB) === 0;
}

export const apiTest = test.extend({
	// eslint-disable-next-line no-empty-pattern
	async api({}, use: Use<UtilityApi>) {
		const assetDirectory = new URL(
			`${randomBytes(20).toString('base64url')}/`,
			parentTemporaryDirectory,
		);

		await mkdir(assetDirectory, {recursive: true});

		const database = new DatabaseSync(':memory:');
		const api = await createApi({
			database,
			assetDirectory,
			dataDirectory: assetDirectory,
			fileSizeLimit: 10 * 1024 * 1024,
		});

		const utilityApi = {
			...api,
			database,
		} satisfies UtilityApi;

		await use(utilityApi);

		database.close();
		await rm(assetDirectory, {recursive: true});
	},
});
