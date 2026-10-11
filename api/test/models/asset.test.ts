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

import {describe, expect} from 'vitest';

import {ApiError} from '../../src/error.js';
import {apiTest, compareFile, sampleAssetPaths} from '../utilities.js';

describe('Pdf', () => {
	apiTest('Creating pdf asset from file', async ({api: {Asset, PdfAsset}}) => {
		const pdfBuffer = await readFile(sampleAssetPaths.pdf);

		const asset = await PdfAsset.createFromBuffer(pdfBuffer);

		await expect(
			compareFile(await asset.read(), pdfBuffer),
		).resolves.toStrictEqual(true);
		expect(asset.name).toMatch(/\.pdf$/);

		const assetCopy = await Asset.fromName(asset.name);
		expect(assetCopy).toBeDefined();
		expect(assetCopy!.name).toStrictEqual(asset.name);
	});

	apiTest('Creating pdf asset from url', async ({api: {Asset, PdfAsset}}) => {
		const asset = await PdfAsset.createFromUrl(
			'https://static.googleusercontent.com/media/www.google.com/en//pdf/google_ftc_dec2012.pdf',
		);

		expect(asset.name).toMatch(/\.pdf$/);
		const file = await asset.read();
		expect(file.byteLength).toStrictEqual(1_353_640);

		const assetCopy = await Asset.fromName(asset.name);
		expect(assetCopy).toBeDefined();
	});
});

describe('Image', () => {
	const paths = Object.entries(sampleAssetPaths).filter(
		([key]) => key !== 'pdf',
	);

	apiTest.for(paths)(
		'Creating image from file (%s)',
		async ([extension, path], {api: {Asset, ImageAsset}}) => {
			const fileBuffer = await readFile(path);
			const asset = await ImageAsset.createFromBuffer(fileBuffer);

			expect(asset.name).toMatch(new RegExp(String.raw`\.${extension}`));

			const assetCopy = await Asset.fromName(asset.name);
			expect(assetCopy).toBeDefined();
		},
	);

	apiTest('Optimising svg', async ({api: {ImageAsset}}) => {
		const fileBuffer = await readFile(sampleAssetPaths.svg);
		const asset = await ImageAsset.createFromBuffer(fileBuffer);
		const optimisedBuffer = await asset.read();

		expect(optimisedBuffer.byteLength).toBeLessThan(fileBuffer.byteLength);
	});

	apiTest('Removing exif data', async ({api: {ImageAsset}}) => {
		const fileBuffer = await readFile(sampleAssetPaths.jpg);
		const asset = await ImageAsset.createFromBuffer(fileBuffer);
		const optimisedBuffer = await asset.read();

		expect(optimisedBuffer.byteLength).toBeLessThan(fileBuffer.byteLength);
	});
});

describe('Asset', () => {
	apiTest.for([
		'http://localhost/abc',
		'https://127.0.0.1/abc',
		'http://[::1]/ghh',
		'https://localhost.lusc.ch/def',
		'ftp://ftp.google.com',
		'j3892',
	])('Internal or invalid URL %s', async (url, {api: {ImageAsset}}) => {
		await expect(
			(async () => {
				await ImageAsset.createFromUrl(url);
			})(),
		).rejects.throws(ApiError);
	});

	apiTest('Removing file', async ({api: {ImageAsset, Asset}}) => {
		const asset = await ImageAsset.createFromFile(sampleAssetPaths.jpg);

		const assetCopy1 = await Asset.fromName(asset.name);
		expect(assetCopy1).toBeDefined();

		await asset.rm();

		const assetCopy2 = await Asset.fromName(asset.name);
		expect(assetCopy2).toBeUndefined();
	});
});
