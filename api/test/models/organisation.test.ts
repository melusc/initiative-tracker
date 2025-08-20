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

import {type Asset} from '../../src/models/asset.js';
import {apiTest, sampleAssetPaths} from '../utilities.js';

apiTest.for([
	['with', true],
	['without', false],
] as const)(
	'Create organisation %s optional values',
	async ([_, includeOptionals], {api: {Organisation, ImageAsset}}) => {
		let imageAsset: Asset | undefined;

		if (includeOptionals) {
			imageAsset = await ImageAsset.createFromFile(sampleAssetPaths.webp);
		}

		const organisation = Organisation.create(
			'Organisation Org',
			imageAsset,
			includeOptionals ? 'https://bing.com/' : undefined,
		);

		expect(organisation.toJSON()).toStrictEqual({
			id: organisation.id,
			slug: 'organisation-org',
			name: 'Organisation Org',
			image: imageAsset?.name ?? null,
			createdAt: organisation.createdAt.getTime(),
			updatedAt: organisation.updatedAt.getTime(),
			website: includeOptionals ? 'https://bing.com/' : null,
			initiatives: [],
		});
	},
);

apiTest(
	'Creating organisations with clashing slugs',
	({api: {Organisation}}) => {
		const organisation1 = Organisation.create(
			'organisation',
			undefined,
			undefined,
		);
		const organisation2 = Organisation.create(
			'örganisation',
			undefined,
			undefined,
		);

		expect(organisation1.slug).toStrictEqual('organisation');
		expect(organisation2.slug).toStrictEqual('organisation-1');

		const organisation3 = Organisation.create('abc', undefined, undefined);
		organisation3.updateName('Organisation');
		expect(organisation3.slug).toStrictEqual('organisation-2');
	},
);

apiTest('Updating values', async ({api: {Organisation, ImageAsset}}) => {
	const imageAsset1 = await ImageAsset.createFromFile(sampleAssetPaths.png);
	const imageAsset2 = await ImageAsset.createFromFile(sampleAssetPaths.svg);

	const organisation = Organisation.create(
		'Organisation Abc',
		imageAsset1,
		'https://bing.com/',
	);

	await expect(
		Organisation.fromSlug('organisation-abc'),
	).resolves.toBeDefined();

	let ud = organisation.updatedAt.getTime();
	organisation.updateName('Organisation XYZ');
	expect(ud).toBeLessThan((ud = organisation.updatedAt.getTime()));
	await setTimeout(2);

	await organisation.updateImage(undefined);
	expect(ud).toBeLessThan((ud = organisation.updatedAt.getTime()));
	await setTimeout(2);

	organisation.updateWebsite(undefined);
	expect(organisation.updatedAt.getTime()).toBeGreaterThan(ud);
	await setTimeout(2);

	await expect(ImageAsset.fromName(imageAsset1.name)).resolves.toBeUndefined();

	let organisationCopy = await Organisation.fromId(organisation.id);

	expect(organisation.toJSON()).toStrictEqual({
		id: organisation.id,
		slug: 'organisation-xyz',
		name: 'Organisation XYZ',
		image: null,
		website: null,
		updatedAt: organisation.updatedAt.getTime(),
		createdAt: organisation.createdAt.getTime(),
		initiatives: [],
	});

	expect(organisationCopy!.toJSON()).toStrictEqual(organisation.toJSON());

	await organisation.updateImage(imageAsset2);

	organisation.updateWebsite('https://duck.com/');

	expect(organisation.image?.name).toStrictEqual(imageAsset2.name);
	expect(organisation.website).toStrictEqual('https://duck.com/');

	organisationCopy = await Organisation.fromId(organisation.id);

	expect(organisationCopy!.toJSON()).toStrictEqual(organisation.toJSON());

	await expect(
		Organisation.fromSlug('organisation-xyz'),
	).resolves.toBeDefined();
});

apiTest('Removing organisation', async ({api: {Organisation, ImageAsset}}) => {
	const imageAsset = await ImageAsset.createFromFile(sampleAssetPaths.webp);

	const organisation = Organisation.create(
		'organisation',
		imageAsset,
		'https://google.com/',
	);

	await expect(Organisation.fromId(organisation.id)).resolves.toBeDefined();

	await organisation.rm();

	await expect(ImageAsset.fromName(imageAsset.name)).resolves.toBeUndefined();
	await expect(Organisation.fromId(organisation.id)).resolves.toBeUndefined();
});

apiTest(
	'Add initiative to organisation',
	async ({api: {Organisation, Initiative, PdfAsset, Login}}) => {
		const pdfAsset = await PdfAsset.createFromFile(sampleAssetPaths.pdf);

		const login = await Login.create('login', 'login', true);

		const organisation1 = Organisation.create(
			'organisation 10',
			undefined,
			undefined,
		);
		const organisation2 = Organisation.create(
			'organisation 2',
			undefined,
			undefined,
		);

		const initiative1 = Initiative.create(
			'initiative 10',
			'initiative',
			undefined,
			pdfAsset,
			undefined,
			undefined,
			undefined,
		);
		const initiative2 = Initiative.create(
			'initiative 2',
			'initiative',
			undefined,
			pdfAsset,
			undefined,
			undefined,
			undefined,
		);

		await organisation1.resolveInitiatives();
		await organisation2.resolveInitiatives();

		organisation1.addInitiative(initiative1);
		organisation2.addInitiative(initiative2);

		expect(
			organisation1.initiatives.map(initiative => initiative.id),
		).toStrictEqual([initiative1.id]);
		expect(
			organisation2.initiatives.map(initiative => initiative.id),
		).toStrictEqual([initiative2.id]);

		await organisation1.resolveInitiatives();
		await organisation2.resolveInitiatives();

		expect(
			organisation1.initiatives.map(initiative => initiative.id),
		).toStrictEqual([initiative1.id]);
		expect(
			organisation2.initiatives.map(initiative => initiative.id),
		).toStrictEqual([initiative2.id]);

		await initiative1.resolveSignaturesOrganisations(login);
		await initiative2.resolveSignaturesOrganisations(login);

		expect(initiative1.organisations.map(o => o.id)).toStrictEqual([
			organisation1.id,
		]);
		expect(initiative2.organisations.map(o => o.id)).toStrictEqual([
			organisation2.id,
		]);

		organisation1.addInitiative(initiative2);
		organisation2.removeInitiative(initiative2);

		expect(
			organisation1.initiatives.map(initiative => initiative.id),
		).toStrictEqual([initiative2.id, initiative1.id]);
		expect(organisation2.initiatives).toHaveLength(0);

		await organisation1.resolveInitiatives();
		await organisation2.resolveInitiatives();

		expect(
			organisation1.initiatives.map(initiative => initiative.id),
		).toStrictEqual([initiative2.id, initiative1.id]);
		expect(organisation2.initiatives).toHaveLength(0);

		await initiative1.resolveSignaturesOrganisations(login);
		await initiative2.resolveSignaturesOrganisations(login);

		expect(initiative1.organisations.map(o => o.id)).toStrictEqual([
			organisation1.id,
		]);
		expect(initiative2.organisations.map(o => o.id)).toStrictEqual([
			organisation1.id,
		]);
	},
);
