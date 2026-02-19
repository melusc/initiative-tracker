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

import {Buffer} from 'node:buffer';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

import type {Request} from 'express';
import multer, {memoryStorage} from 'multer';

// Implicitely create `data/` when creating `data/pdf`
export const dataDirectory = new URL('../../data/', import.meta.url);
export const assetDirectory = new URL('assets/', dataDirectory);
await mkdir(assetDirectory, {recursive: true});

export const staticRoot = fileURLToPath(
	import.meta.resolve('@lusc/initiative-tracker-frontend'),
);

export const fileSizeLimit = 10_485_760; // 10 MB
export const multerUpload = multer({
	storage: memoryStorage(),
	limits: {
		fileSize: fileSizeLimit,
	},
});

export function mergeExpressBodyFile(request: Request, keys: string[]) {
	const files = request.files as unknown as
		| Record<string, Express.Multer.File[]>
		| undefined;

	const body = {
		...(request.body as Record<string, unknown>),
	};

	for (const key of keys) {
		const item = files?.[key]?.[0]?.buffer;
		if (item && item.byteLength > 0) {
			body[key] = Buffer.from(item);
		}
	}

	return body;
}
