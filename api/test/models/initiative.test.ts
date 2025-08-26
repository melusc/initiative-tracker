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

import {setTimeout} from 'node:timers/promises';

import {expect} from 'vitest';

import type {Asset} from '../../src/models/asset.js';
import {apiTest, sampleAssetPaths} from '../utilities.js';

apiTest.for([
	['with', true],
	['without', false],
] as const)(
	'Creating an initiative %s optional values',
	async ([_, withOptionals], {api: {Initiative, PdfAsset, ImageAsset}}) => {
		const pdfAsset = await PdfAsset.createFromFile(sampleAssetPaths.pdf);

		let imageAsset: Asset | undefined;

		if (withOptionals) {
			imageAsset = await ImageAsset.createFromFile(sampleAssetPaths.jpg);
		}

		const initiative = Initiative.create(
			'Initiative 1',
			'Initiative Long Name',
			withOptionals ? 'https://google.com/' : undefined,
			pdfAsset,
			imageAsset,
			withOptionals ? '2025-05-12' : undefined,
			withOptionals ? '2024-01-05' : undefined,
			withOptionals ? 'https://www.bk.admin.ch' : undefined,
		);

		const initiativeCopy = (await Initiative.fromId(initiative.id))!;

		expect(initiativeCopy.toJSON()).toEqual({
			id: initiative.id,
			slug: 'initiative-1',
			shortName: 'Initiative 1',
			fullName: 'Initiative Long Name',
			website: withOptionals ? 'https://google.com/' : null,
			pdf: pdfAsset.name,
			image: imageAsset?.name ?? null,
			deadline: withOptionals ? '2025-05-12' : null,
			initiatedDate: withOptionals ? '2024-01-05' : null,
			bundeskanzleiUrl: withOptionals ? 'https://www.bk.admin.ch' : null,
			organisations: [],
			signatures: [],
			createdAt: initiativeCopy.createdAt.getTime(),
			updatedAt: initiativeCopy.updatedAt.getTime(),
		});
	},
);

apiTest(
	'Creating initiatives with clashing slugs',
	async ({api: {Initiative, PdfAsset}}) => {
		const pdfAsset1 = await PdfAsset.createFromFile(sampleAssetPaths.pdf);
		const pdfAsset2 = await PdfAsset.createFromFile(sampleAssetPaths.pdf);
		const pdfAsset3 = await PdfAsset.createFromFile(sampleAssetPaths.pdf);

		const initiative1 = Initiative.create(
			'Initiative',
			'Initiative',
			undefined,
			pdfAsset1,
			undefined,
			undefined,
			undefined,
			undefined,
		);
		const initiative2 = Initiative.create(
			'Înitiativé',
			'Înitiativé',
			undefined,
			pdfAsset2,
			undefined,
			undefined,
			undefined,
			undefined,
		);

		expect(initiative1.slug).toStrictEqual('initiative');
		expect(initiative2.slug).toStrictEqual('initiative-1');

		const initiative3 = Initiative.create(
			'abc',
			'abc',
			undefined,
			pdfAsset3,
			undefined,
			undefined,
			undefined,
			undefined,
		);

		initiative3.updateShortName('initiative');
		expect(initiative3.slug).toStrictEqual('initiative-2');
	},
);

apiTest(
	'Modifying values',
	async ({api: {Initiative, PdfAsset, ImageAsset, Asset}}) => {
		const pdfAsset1 = await PdfAsset.createFromFile(sampleAssetPaths.pdf);
		const pdfAsset2 = await PdfAsset.createFromFile(sampleAssetPaths.pdf);

		const imageAsset1 = await ImageAsset.createFromFile(sampleAssetPaths.svg);

		const imageAsset2 = await ImageAsset.createFromFile(sampleAssetPaths.jpg);

		const initiative = Initiative.create(
			'Initiative',
			'Initiative Long',
			'https://abc.com/',
			pdfAsset1,
			imageAsset1,
			'deadline',
			'initiated',
			'https://www.bk.admin.ch',
		);

		let ud = initiative.updatedAt.getTime();
		await setTimeout(2);

		initiative.updateShortName('Initiative New');
		expect(initiative.shortName).toStrictEqual('Initiative New');
		expect(initiative.slug).toStrictEqual('initiative-new');
		expect(ud).toBeLessThan((ud = initiative.updatedAt.getTime()));
		await setTimeout(2);

		initiative.updateFullName('Initiative Long New');
		expect(initiative.fullName).toStrictEqual('Initiative Long New');
		expect(ud).toBeLessThan((ud = initiative.updatedAt.getTime()));
		await setTimeout(2);

		await initiative.updateImage(undefined);
		expect(initiative.image).toBeUndefined();
		await expect(Asset.fromName(imageAsset1.name)).resolves.toBeUndefined();
		expect(ud).toBeLessThan((ud = initiative.updatedAt.getTime()));
		await setTimeout(2);

		await initiative.updateImage(imageAsset2);
		expect(initiative.image?.name).toStrictEqual(imageAsset2.name);
		expect(ud).toBeLessThan((ud = initiative.updatedAt.getTime()));
		await setTimeout(2);

		await initiative.updatePdf(pdfAsset2);
		expect(initiative.pdf.name).toStrictEqual(pdfAsset2.name);
		await expect(Asset.fromName(pdfAsset1.name)).resolves.toBeUndefined();
		expect(ud).toBeLessThan((ud = initiative.updatedAt.getTime()));
		await setTimeout(2);

		initiative.updateDeadline(undefined);
		expect(initiative.deadline).toBeUndefined();
		expect(ud).toBeLessThan((ud = initiative.updatedAt.getTime()));
		await setTimeout(2);

		initiative.updateInitiatedDate(undefined);
		expect(initiative.initiatedDate).toBeUndefined();
		expect(ud).toBeLessThan((ud = initiative.updatedAt.getTime()));
		await setTimeout(2);

		initiative.updateBundeskanzleiUrl(undefined);
		expect(initiative.bundeskanzleiUrl).toBeUndefined();
		expect(ud).toBeLessThan((ud = initiative.updatedAt.getTime()));
		await setTimeout(2);

		initiative.updateWebsite(undefined);
		expect(initiative.website).toBeUndefined();
		expect(initiative.updatedAt.getTime()).toBeGreaterThan(ud);
		await setTimeout(2);

		const initiativeCopy = await Initiative.fromId(initiative.id);

		expect(initiativeCopy!.toJSON()).toStrictEqual(initiative.toJSON());
	},
);

apiTest(
	'Adding and removing organisations',
	async ({api: {Initiative, Login, Organisation, PdfAsset}}) => {
		const owner = await Login.create('login', 'login', true);

		const pdfAsset = await PdfAsset.createFromFile(sampleAssetPaths.pdf);

		const organisation1 = Organisation.create(
			'B organisation1',
			undefined,
			'https://organisation1/',
		);
		const organisation2 = Organisation.create(
			'A organisation2',
			undefined,
			'https://organisation2/',
		);

		const initiative = Initiative.create(
			'initiative',
			'initiative',
			undefined,
			pdfAsset,
			undefined,
			undefined,
			undefined,
			undefined,
		);

		await initiative.resolveSignaturesOrganisations(owner);
		expect(initiative.organisations).toHaveLength(0);

		initiative.addOrganisation(organisation1);

		expect(initiative.organisations).toHaveLength(1);

		let initiativeCopy = await Initiative.fromId(initiative.id);
		await initiativeCopy!.resolveSignaturesOrganisations(owner);
		expect(
			initiativeCopy!.organisations.map(organisation => organisation.id),
		).toStrictEqual([organisation1.id]);

		initiative.addOrganisation(organisation2);

		expect(
			initiative.organisations.map(organisation => organisation.id),
		).toStrictEqual([organisation2.id, organisation1.id]);

		initiativeCopy = await Initiative.fromId(initiative.id);
		await initiativeCopy!.resolveSignaturesOrganisations(owner);
		expect(
			initiativeCopy!.organisations.map(organisation => organisation.id),
		).toStrictEqual([organisation2.id, organisation1.id]);

		initiative.removeOrganisation(organisation2);

		expect(initiative.organisations).toHaveLength(1);
		expect(initiative.organisations[0]!.id).toStrictEqual(organisation1.id);

		initiativeCopy = await Initiative.fromId(initiative.id);
		await initiativeCopy!.resolveSignaturesOrganisations(owner);
		expect(initiativeCopy!.organisations).toHaveLength(1);
	},
);

apiTest(
	'Adding signatures',
	async ({api: {Login, Initiative, Person, PdfAsset}}) => {
		const login1 = await Login.create('login1', 'login1', true);
		const login2 = await Login.create('login2', 'login2', true);

		const pdfAsset = await PdfAsset.createFromFile(sampleAssetPaths.pdf);

		const initiativeLoginP1 = Initiative.create(
			'Initiative',
			'Initiative',
			undefined,
			pdfAsset,
			undefined,
			undefined,
			undefined,
			undefined,
		);
		const initiativeLoginP2 = (await Initiative.fromId(initiativeLoginP1.id))!;

		await initiativeLoginP1.resolveSignaturesOrganisations(login1);
		await initiativeLoginP2.resolveSignaturesOrganisations(login2);

		const person1 = Person.create('p1', login1);
		const person2 = Person.create('p2', login1);
		const person3 = Person.create('p3', login2);
		const person4 = Person.create('p4', login2);

		initiativeLoginP1.addSignature(person1);

		await initiativeLoginP1.resolveSignaturesOrganisations(login1);
		await initiativeLoginP2.resolveSignaturesOrganisations(login2);

		expect(initiativeLoginP1.signatures).toHaveLength(1);
		expect(initiativeLoginP2.signatures).toHaveLength(0);

		initiativeLoginP1.addSignature(person2);
		initiativeLoginP2.addSignature(person3);

		await initiativeLoginP1.resolveSignaturesOrganisations(login1);
		await initiativeLoginP2.resolveSignaturesOrganisations(login2);

		expect(initiativeLoginP1.signatures).toHaveLength(2);
		expect(initiativeLoginP2.signatures).toHaveLength(1);

		initiativeLoginP1.removeSignature(person2);
		initiativeLoginP2.removeSignature(person3);
		initiativeLoginP2.addSignature(person4);

		expect(initiativeLoginP1.signatures).toHaveLength(1);
		expect(initiativeLoginP2.signatures).toHaveLength(1);

		await initiativeLoginP1.resolveSignaturesOrganisations(login1);
		await initiativeLoginP2.resolveSignaturesOrganisations(login2);

		expect(initiativeLoginP1.signatures).toHaveLength(1);
		expect(initiativeLoginP2.signatures).toHaveLength(1);
	},
);

apiTest(
	'Removing initiative',
	async ({api: {Initiative, PdfAsset, ImageAsset}}) => {
		const pdfAsset = await PdfAsset.createFromFile(sampleAssetPaths.pdf);

		const imageAsset = await ImageAsset.createFromFile(sampleAssetPaths.jpg);

		const initiative = Initiative.create(
			'Initiative',
			'Initiative',
			undefined,
			pdfAsset,
			imageAsset,
			undefined,
			undefined,
			undefined,
		);

		await expect(Initiative.fromId(initiative.id)).resolves.toBeDefined();

		await initiative.rm();

		await expect(Initiative.fromId(initiative.id)).resolves.toBeUndefined();

		await expect(PdfAsset.fromName(pdfAsset.name)).resolves.toBeUndefined();
		await expect(ImageAsset.fromName(imageAsset.name)).resolves.toBeUndefined();
	},
);
