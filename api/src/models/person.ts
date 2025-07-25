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

import {randomBytes} from 'node:crypto';

import {
	sortInitiatives,
	sortPeople,
} from '@lusc/initiative-tracker-util/sort.js';
import {makeSlug} from '@lusc/util/slug';

import {ApiError} from '../error.js';
import {InjectableApi} from '../injectable-api.js';

import type {Initiative, InitiativeJson} from './initiative.js';
import type {Login} from './login.js';

type SqlPersonRow = {
	id: string;
	slug: string;
	name: string;
	owner: string;
};

export type PersonJson = {
	id: string;
	slug: string;
	name: string;
	owner: string;
	signatures: InitiativeJson[];
};

const privateConstructorKey = Symbol();

export class Person extends InjectableApi {
	private _slug: string;
	private _name: string;
	private _owner: Login;
	private _signatures: Initiative[] = [];
	private _signaturesResolved = false;

	constructor(
		readonly id: string,
		slug: string,
		name: string,
		owner: Login,
		constructorKey: symbol,
	) {
		if (constructorKey !== privateConstructorKey) {
			throw new ApiError('Person.contructor is private.');
		}

		super();

		this._slug = slug;
		this._name = name;
		this._owner = owner;
	}

	get slug() {
		return this._slug;
	}

	get name() {
		return this._name;
	}

	get owner() {
		return this._owner;
	}

	get signatures() {
		return this._signatures;
	}

	private static _fromRow(row: SqlPersonRow, owner: Login): Person;
	private static _fromRow(
		row: SqlPersonRow | undefined,
		owner: Login,
	): Person | undefined;
	private static _fromRow(row: SqlPersonRow | undefined, owner: Login) {
		if (!row) {
			return;
		}

		// Check if owner is who we expected
		// Could indicate that SQL query was written without
		// `WHERE owner = :owner`
		const resolvedOwner = this.Login.fromUserId(row.owner);
		if (resolvedOwner?.id !== owner.id) {
			return;
		}

		return new this.Person(
			row.id,
			row.slug,
			row.name,
			owner,
			privateConstructorKey,
		);
	}

	static fromName(name: string, owner: Login) {
		const row = this.database
			.prepare(
				`SELECT * from people
				WHERE name = :name AND owner = :owner`,
			)
			.get({
				name,
				owner: owner.id,
			}) as SqlPersonRow | undefined;

		return this._fromRow(row, owner);
	}

	static fromId(id: string, owner: Login) {
		const row = this.database
			.prepare(
				`SELECT * FROM people
				WHERE id = :id AND owner = :owner`,
			)
			.get({
				id: id,
				owner: owner.id,
			}) as SqlPersonRow | undefined;

		return this._fromRow(row, owner);
	}

	static fromSlug(slug: string, owner: Login) {
		const row = this.database
			.prepare(
				`SELECT * from people
				WHERE slug = :slug AND owner = :owner`,
			)
			.get({
				slug,
				owner: owner.id,
			}) as SqlPersonRow | undefined;

		return this._fromRow(row, owner);
	}

	static all(owner: Login) {
		const rows = this.database
			.prepare(
				`SELECT * FROM people
				WHERE owner = :owner`,
			)
			.all({
				owner: owner.id,
			}) as SqlPersonRow[];

		const people = rows.map(row => this._fromRow(row, owner));
		return sortPeople(people);
	}

	static create(name: string, owner: Login) {
		const slug = makeSlug(name, {appendRandomHex: false});

		const sameName = this.fromSlug(slug, owner);
		if (sameName) {
			throw new ApiError('Person with the same name exists already.');
		}

		const id = 'p-' + randomBytes(20).toString('base64url');

		try {
			this.database
				.prepare(
					`INSERT INTO people
					(id, slug, name, owner)
					VALUES (:id, :slug, :name, :owner)`,
				)
				.run({
					id,
					slug,
					name,
					owner: owner.id,
				});
		} catch {
			throw new ApiError(`Person with the same name exists already.`);
		}

		return new this.Person(id, slug, name, owner, privateConstructorKey);
	}

	// Avoid infinite recursion
	// Only resolve explicitly
	async resolveSignatures() {
		const signatureRows = this.database
			.prepare(
				`SELECT initiativeId FROM signatures
				WHERE personId = :personId`,
			)
			.all({
				personId: this.id,
			}) as Array<{initiativeId: string}>;

		const signatures = (await Promise.all(
			signatureRows.map(({initiativeId}) =>
				this.Initiative.fromId(initiativeId),
			),
		)) as Array<Initiative>;

		this._signatures = sortInitiatives(signatures);
		this._signaturesResolved = true;
	}

	toJSON(): PersonJson {
		return {
			id: this.id,
			slug: this.slug,
			name: this.name,
			owner: this.owner.id,
			signatures: this.signatures.map(signature => signature.toJSON()),
		};
	}

	updateName(newName: string) {
		if (newName === this.name) {
			return;
		}

		const newSlug = makeSlug(newName, {appendRandomHex: false});
		const sameName = this.Person.fromSlug(newSlug, this.owner);
		if (sameName) {
			throw new ApiError('Person with the same name exists already.');
		}

		this.database
			.prepare(
				`UPDATE people
				SET name = :name,
					slug = :slug
				WHERE id = :id`,
			)
			.run({
				name: newName,
				slug: newSlug,
				id: this.id,
			});

		this._name = newName;
		this._slug = newSlug;
	}

	rm() {
		this.database
			.prepare(
				`DELETE FROM people
				WHERE id = :id`,
			)
			.run({
				id: this.id,
			});
	}

	addSignature(initiative: Initiative) {
		if (!this._signaturesResolved) {
			throw new ApiError('Must initialise signatures.');
		}

		try {
			this.database
				.prepare(
					`INSERT INTO signatures
					(initiativeId, personId)
					VALUES (:initiativeId, :personId)`,
				)
				.run({
					initiativeId: initiative.id,
					personId: this.id,
				});

			this._signatures = sortInitiatives([...this.signatures, initiative]);
		} catch (error: unknown) {
			console.error(error);
		}
	}

	removeSignature(initiative: Initiative) {
		if (!this._signaturesResolved) {
			throw new ApiError('Must initialise signatures.');
		}

		this.database
			.prepare(
				`DELETE FROM signatures
				WHERE initiativeId = :initiativeId
				AND personId = :personId`,
			)
			.run({
				initiativeId: initiative.id,
				personId: this.id,
			});

		this._signatures = this.signatures.filter(
			other => other.id !== initiative.id,
		);
	}
}
