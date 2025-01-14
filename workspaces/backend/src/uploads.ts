/*!
Copyright (C)Luca Schnellmann, 2025

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
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

import type {
	Initiative,
	Organisation,
} from '@lusc/initiative-tracker-util/types.js';
import type {Request} from 'express';
import {fileTypeFromBuffer} from 'file-type';
import multer, {memoryStorage} from 'multer';
import {optimize as svgoOptimise} from 'svgo';

import {validateUrl} from './validate-body.ts';

export const dataDirectory = new URL('../data/', import.meta.url);
await mkdir(dataDirectory, {recursive: true});

export const pdfOutDirectory = new URL('pdf/', dataDirectory);
await mkdir(pdfOutDirectory, {recursive: true});

export const imageOutDirectory = new URL('image/', dataDirectory);
await mkdir(imageOutDirectory, {recursive: true});

export const staticRoot = fileURLToPath(
	import.meta.resolve('@lusc/initiative-tracker-frontend'),
);

const fileSizeLimit = 10_485_760; // 10 MB
const allowedImages: ReadonlySet<string> = new Set<string>([
	'image/jpeg',
	'image/png',
	'image/avif',
	'image/webp',
]);
export const multerUpload = multer({
	storage: memoryStorage(),
	limits: {
		fileSize: fileSizeLimit,
	},
});

export function transformOrganisationUrls<T extends Organisation>(
	organisation: T,
): T {
	return {
		...organisation,
		image:
			organisation.image === null
				? null
				: transformImageUrl(organisation.image),
	};
}

export function transformInitiativeUrls<T extends Initiative>(
	initiative: T,
): T {
	return {
		...initiative,
		pdf: transformPdfUrl(initiative.pdf),
		image: transformImageUrl(initiative.image),
	};
}

export function transformImageUrl(imageUrl: string | null) {
	if (imageUrl === null) {
		return null;
	}

	return `/api/user-content/image/${imageUrl}`;
}

export function transformPdfUrl(pdfUrl: string) {
	return `/api/user-content/pdf/${pdfUrl}`;
}

/**
 * Timeout after five seconds. Disallow files greater than 10 mb
 */
async function safeFetch(url: URL) {
	const controller = new AbortController();
	const {signal} = controller;
	setTimeout(() => {
		controller.abort();
	}, 5e3);
	const response = await fetch(url, {signal});

	const urlValidity = await validateUrl('', response.url);
	if (urlValidity.type === 'error') {
		throw new Error('Internal url');
	}

	const body = await response.arrayBuffer();

	if (body.byteLength > fileSizeLimit) {
		throw new Error('File is too large');
	}

	return Buffer.from(body);
}

function handleSvg(body: string): FetchedFile {
	try {
		const id = [randomUUID(), 'svg'].join('.');
		const suggestedFilePath = new URL(id, imageOutDirectory);

		const optimised = svgoOptimise(body, {
			path: fileURLToPath(suggestedFilePath),
			multipass: true,
		});

		return {
			id,
			suggestedFilePath,
			body: Buffer.from(optimised.data),
		};
	} catch {
		throw new Error('Not an image.');
	}
}

export type FetchedFile = {
	id: string;
	suggestedFilePath: URL;
	body: Buffer;
};

export async function fetchImage(image: URL | Buffer): Promise<FetchedFile> {
	const body = Buffer.isBuffer(image) ? image : await safeFetch(image);

	if (body.byteLength > fileSizeLimit) {
		throw new Error('File is too large');
	}

	const stringified = Buffer.from(body).toString();

	const type = await fileTypeFromBuffer(body);

	if (type?.mime === 'application/xml' || stringified.includes('<svg')) {
		return handleSvg(stringified);
	}

	if (!type || !allowedImages.has(type.mime)) {
		throw new Error('Not an image.');
	}

	const id = [randomUUID(), type.ext].join('.');

	return {
		id,
		suggestedFilePath: new URL(id, imageOutDirectory),
		body,
	};
}

export async function fetchPdf(pdf: URL | Buffer): Promise<FetchedFile> {
	const body = Buffer.isBuffer(pdf) ? pdf : await safeFetch(pdf);

	if (body.byteLength > fileSizeLimit) {
		throw new Error('File is too large');
	}

	const type = await fileTypeFromBuffer(body);

	if (type?.mime !== 'application/pdf') {
		throw new Error('Not a pdf.');
	}

	const id = randomUUID() + '.pdf';

	return {
		id,
		suggestedFilePath: new URL(id, pdfOutDirectory),
		body,
	};
}

export function mergeExpressBodyFile(request: Request, keys: string[]) {
	const files = request.files as unknown as
		| Record<string, Express.Multer.File[]>
		| undefined;

	const body = {
		...(request.body as Record<string, unknown>),
	};

	for (const key of keys) {
		const item = files?.[key]?.[0]?.buffer;
		if (item) {
			body[key] = Buffer.from(item);
		}
	}

	return body;
}
