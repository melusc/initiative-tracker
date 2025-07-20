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

import {expect} from 'vitest';

import type {Asset} from '../../src/models/asset.js';
import {apiTest, sampleAssetPaths} from '../utilities.js';

apiTest.for([
	['with', true],
	['without', false],
] as const)(
	'Creating an initiative %s optional values',
	async ([_, withOptionals], {api: {Initiative, PdfAsset, ImageAsset}}) => {
		// eslint-disable-next-line security/detect-non-literal-fs-filename
		const pdfBuffer = await readFile(sampleAssetPaths.pdf);
		const pdfAsset = await PdfAsset.createFromFile(pdfBuffer);

		let imageAsset: Asset | undefined;

		if (withOptionals) {
			// eslint-disable-next-line security/detect-non-literal-fs-filename
			const imageBuffer = await readFile(sampleAssetPaths.jpg);
			imageAsset = await ImageAsset.createFromFile(imageBuffer);
		}

		const initiative = Initiative.create(
			'Initiative 1',
			'Initiative Long Name',
			withOptionals ? 'https://google.com/' : undefined,
			pdfAsset,
			imageAsset,
			withOptionals ? '2025-05-12' : undefined,
		);

		const initiativeCopy = (await Initiative.fromId(initiative.id))!;

		expect(initiativeCopy.toJson()).toEqual({
			id: 'initiative-1',
			shortName: 'Initiative 1',
			fullName: 'Initiative Long Name',
			website: withOptionals ? 'https://google.com/' : null,
			pdf: pdfAsset.name,
			image: imageAsset?.name ?? null,
			deadline: withOptionals ? '2025-05-12' : null,
			organisations: [],
			signatures: [],
		});
	},
);

apiTest(
	'Modifying values',
	async ({api: {Initiative, PdfAsset, ImageAsset, Asset}}) => {
		// eslint-disable-next-line security/detect-non-literal-fs-filename
		const pdfBuffer = await readFile(sampleAssetPaths.pdf);
		const pdfAsset1 = await PdfAsset.createFromFile(pdfBuffer);
		const pdfAsset2 = await PdfAsset.createFromFile(pdfBuffer);

		// eslint-disable-next-line security/detect-non-literal-fs-filename
		const imageBuffer1 = await readFile(sampleAssetPaths.svg);
		const imageAsset1 = await ImageAsset.createFromFile(imageBuffer1);

		// eslint-disable-next-line security/detect-non-literal-fs-filename
		const imageBuffer2 = await readFile(sampleAssetPaths.jpg);
		const imageAsset2 = await ImageAsset.createFromFile(imageBuffer2);

		const initiative = Initiative.create(
			'Initiative',
			'Initiative Long',
			'https://abc.com/',
			pdfAsset1,
			imageAsset1,
			'deadline',
		);

		initiative.updateShortName('Initiative New');
		expect(initiative.shortName).toStrictEqual('Initiative New');

		initiative.updateFullName('Initiative Long New');
		expect(initiative.fullName).toStrictEqual('Initiative Long New');

		await initiative.updateImage(undefined);
		expect(initiative.image).toBeUndefined();
		await expect(Asset.fromName(imageAsset1.name)).resolves.toBeUndefined();

		await initiative.updateImage(imageAsset2);
		expect(initiative.image?.name).toStrictEqual(imageAsset2.name);

		await initiative.updatePdf(pdfAsset2);
		expect(initiative.pdf.name).toStrictEqual(pdfAsset2.name);
		await expect(Asset.fromName(pdfAsset1.name)).resolves.toBeUndefined();

		initiative.updateDeadline(undefined);
		expect(initiative.deadline).toBeUndefined();

		initiative.updateWebsite(undefined);
		expect(initiative.website).toBeUndefined();

		const initiativeCopy = await Initiative.fromId(initiative.id);

		expect(initiativeCopy!.toJson()).toStrictEqual(initiative.toJson());
	},
);
