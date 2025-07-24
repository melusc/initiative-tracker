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

import {readdir, unlink} from 'node:fs/promises';

import type {Api} from './injectable-api.js';

export async function removeUnusedAssets(assetDirectory: URL, api: Api) {
	// eslint-disable-next-line security/detect-non-literal-fs-filename
	const diskAssets = new Set<string>(await readdir(assetDirectory));

	for (const initiative of await api.Initiative.all()) {
		diskAssets.delete(initiative.pdf.name);
		if (initiative.image) {
			diskAssets.delete(initiative.image.name);
		}
	}

	for (const organisation of await api.Organisation.all()) {
		if (organisation.image) {
			diskAssets.delete(organisation.image.name);
		}
	}

	for (const asset of diskAssets) {
		const path = new URL(asset, assetDirectory);
		// eslint-disable-next-line security/detect-non-literal-fs-filename
		await unlink(path);
	}
}
