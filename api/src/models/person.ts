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

import {sortInitiatives} from '@lusc/initiative-tracker-util/sort.js';
import {makeSlug} from '@lusc/util/slug';

import {ApiError} from '../error.js';
import {InjectableApi} from '../injectable-api.js';

import type {Initiative, InitiativeJson} from './initiative.js';
import type {Login} from './login.js';

type SqlPersonRow = {
	id: string;
	name: string;
	owner: string;
};

export type PersonJson = {
	id: string;
	name: string;
	owner: string;
	signatures: InitiativeJson[];
};

const privateConstructorKey = Symbol();

export class Person extends InjectableApi {
	private _name: string;
	private _owner: Login;
	private _signatures: Initiative[] = [];
	private _signaturesResolved = false;

	constructor(
		readonly id: string,
		name: string,
		owner: Login,
		constructorKey: symbol,
	) {
		if (constructorKey !== privateConstructorKey) {
			throw new ApiError('Person.contructor is private.');
		}

		super();

		this._name = name;
		this._owner = owner;
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

	private static _fromRow(row: SqlPersonRow): Person;
	private static _fromRow(row: SqlPersonRow | undefined): Person | undefined;
	private static _fromRow(row: SqlPersonRow | undefined) {
		if (!row) {
			return;
		}

		const owner = this.Login.fromUserId(row.owner);
		if (!owner) {
			return;
		}

		return new this.Person(row.id, row.name, owner, privateConstructorKey);
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

		return this._fromRow(row);
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

		return this._fromRow(row);
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

		return rows.map(row => this._fromRow(row));
	}

	static create(name: string, owner: Login) {
		const sameName = this.fromName(name, owner);
		if (sameName) {
			throw new ApiError('Person with the same name exists already.');
		}

		const slug = makeSlug(name, {appendRandomHex: false});

		try {
			this.database
				.prepare(
					`INSERT INTO people
					(id, name, owner)
					VALUES (:id, :name, :owner)`,
				)
				.run({
					id: slug,
					name,
					owner: owner.id,
				});
		} catch {
			throw new ApiError(`Person with the same name exists already.`);
		}

		return new this.Person(slug, name, owner, privateConstructorKey);
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

	toJson(): PersonJson {
		return {
			id: this.id,
			name: this.name,
			owner: this.owner.id,
			signatures: this.signatures.map(signature => signature.toJson()),
		};
	}

	updateName(newName: string) {
		if (newName === this.name) {
			return;
		}

		const sameName = this.Person.fromName(newName, this.owner);
		if (sameName) {
			throw new ApiError('Person with the same name exists already.');
		}

		this.database
			.prepare(
				`UPDATE people
				SET name = :name
				WHERE id = :id`,
			)
			.run({
				name: newName,
				id: this.id,
			});

		this._name = newName;
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
					(initiativeId, personId, ownerId)
					VALUES (:initiativeId, :personId, :ownerId)`,
				)
				.run({
					initiativeId: initiative.id,
					personId: this.id,
					ownerId: this.owner.id,
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
