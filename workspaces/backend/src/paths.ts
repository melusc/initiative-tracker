import {randomUUID} from 'node:crypto';
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

import {fileTypeFromBuffer} from 'file-type';

export const dataDirectory = new URL('../data/', import.meta.url);
await mkdir(dataDirectory, {recursive: true});

export const pdfOutDirectory = new URL('pdf/', dataDirectory);
await mkdir(pdfOutDirectory, {recursive: true});

export const imageOutDirectory = new URL('image/', dataDirectory);
await mkdir(imageOutDirectory, {recursive: true});

export const staticRoot = fileURLToPath(
	import.meta.resolve('@lusc/initiatives-tracker-frontend'),
);

export function transformImageUrl(imageUrl: string) {
	return `/api/user-content/image/${imageUrl}`;
}

export function transformPdfUrl(pdfUrl: string) {
	return `/api/user-content/pdf/${pdfUrl}`;
}

/**
 * Timeout after five seconds. Disallow files greater than 10 mb
 */
async function safeFetch(url: string) {
	const controller = new AbortController();
	const {signal} = controller;
	setTimeout(() => {
		controller.abort();
	}, 5e3);
	const response = await fetch(url, {signal});
	const body = await response.arrayBuffer();

	// 10 mb
	if (body.byteLength > 10_485_760) {
		throw new Error('File is too large');
	}

	return body;
}

const allowedImages: ReadonlySet<string> = new Set<string>([
	'image/jpeg',
	'image/png',
	'image/avif',
	'image/webp',
]);

export async function fetchImage(imageUrl: string) {
	const body = await safeFetch(imageUrl);

	const type = await fileTypeFromBuffer(body);

	if (!type || !allowedImages.has(type.mime)) {
		throw new Error('Not an image.');
	}

	const id = randomUUID() + '.' + type.ext;

	await writeFile(new URL(id, imageOutDirectory), new DataView(body));

	return id;
}

export async function fetchPdf(pdfUrl: string) {
	const body = await safeFetch(pdfUrl);

	const type = await fileTypeFromBuffer(body);

	if (type?.mime !== 'application/pdf') {
		throw new Error('Not a pdf.');
	}

	const id = randomUUID() + '.pdf';

	await writeFile(new URL(id, pdfOutDirectory), new DataView(body));

	return id;
}
