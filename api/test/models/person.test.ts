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

import {ApiError} from '../../src/error.js';
import {apiTest, sampleAssetPaths} from '../utilities.js';

apiTest('Creating person', async ({api: {Person, Login}}) => {
	const login = await Login.create('login', 'login', true);

	const person = Person.create('Person Name', login);

	expect(person.name).toStrictEqual('Person Name');
	expect(person.slug).toStrictEqual('person-name');
	expect(person.owner.id).toStrictEqual(login.id);

	expect(person.toJSON()).toStrictEqual({
		id: person.id,
		name: 'Person Name',
		slug: 'person-name',
		owner: login.id,
		createdAt: person.createdAt.getTime(),
		updatedAt: person.updatedAt.getTime(),
		signatures: [],
	});

	const personCopy = Person.fromId(person.id, login);
	expect(personCopy).toBeDefined();
	expect(personCopy!.toJSON()).toStrictEqual(person.toJSON());
});

apiTest('Updating values', async ({api: {Person, Login}}) => {
	const login = await Login.create('login', 'login', true);
	const person = Person.create('Person Name', login);

	const ud = person.updatedAt.getTime();
	await setTimeout(2);

	person.updateName('Person Name 2');
	expect(person.name).toStrictEqual('Person Name 2');
	expect(person.slug).toStrictEqual('person-name-2');
	expect(person.updatedAt.getTime()).toBeGreaterThan(ud);

	const personCopy = Person.fromId(person.id, login)!;
	expect(personCopy.name).toStrictEqual('Person Name 2');
	expect(personCopy.slug).toStrictEqual('person-name-2');
});

apiTest('Removing person', async ({api: {Person, Login}}) => {
	const login = await Login.create('login', 'login', true);
	const person = Person.create('Person Name', login);

	expect(Person.fromId(person.id, login)).toBeDefined();
	person.rm();
	expect(Person.fromId(person.id, login)).toBeUndefined();
});

apiTest('Clashing slugs', async ({api: {Person, Login}}) => {
	const login1 = await Login.create('login1', 'login1', true);
	const login2 = await Login.create('login2', 'login2', true);

	Person.create('abc', login1);
	Person.create('abc', login2);

	expect(() => {
		Person.create('abc', login1);
	}).throws(ApiError, /same name/);

	const person4 = Person.create('def', login1);
	expect(() => {
		person4.updateName('abc');
	}).throws(ApiError, /same name/);
});

apiTest('Signatures', async ({api: {Person, Login, Initiative, PdfAsset}}) => {
	const pdfAsset = await PdfAsset.createFromFile(sampleAssetPaths.pdf);

	const login1 = await Login.create('login1', 'login1', true);
	const login2 = await Login.create('login2', 'login2', true);

	const person1L1 = Person.create('p1', login1);
	const person2L2 = Person.create('p2', login2);

	const initiativeL1 = Initiative.create(
		'initiative',
		'initiative',
		undefined,
		pdfAsset,
		undefined,
		undefined,
		undefined,
	);
	const initiativeL2 = (await Initiative.fromId(initiativeL1.id))!;

	await person1L1.resolveSignatures();
	await person2L2.resolveSignatures();

	person1L1.addSignature(initiativeL1);
	person2L2.addSignature(initiativeL2);
	expect(person1L1.signatures).toHaveLength(1);
	expect(person2L2.signatures).toHaveLength(1);

	await person1L1.resolveSignatures();
	await person2L2.resolveSignatures();
	expect(person1L1.signatures).toHaveLength(1);
	expect(person2L2.signatures).toHaveLength(1);

	await initiativeL1.resolveSignaturesOrganisations(login1);
	await initiativeL2.resolveSignaturesOrganisations(login2);
	expect(initiativeL1.signatures).toHaveLength(1);
	expect(initiativeL2.signatures).toHaveLength(1);

	person2L2.removeSignature(initiativeL2);
	expect(person2L2.signatures).toHaveLength(0);

	await person2L2.resolveSignatures();
	expect(person2L2.signatures).toHaveLength(0);

	await initiativeL2.resolveSignaturesOrganisations(login2);
	expect(initiativeL2.signatures).toHaveLength(0);
});

apiTest('Removing person', async ({api: {Person, Login}}) => {
	const login = await Login.create('login', 'login', true);
	const person = Person.create('abc', login);

	expect(Person.fromId(person.id, login)).toBeDefined();

	person.rm();

	expect(Person.fromId(person.id, login)).toBeUndefined();
});
