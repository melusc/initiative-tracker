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

import {makeSlug} from '@lusc/util/slug';

import {ApiError} from '../error.js';
import {InjectableApi} from '../injectable-api.js';

import type {Login} from './login.js';

type SqlPersonRow = {
	id: string;
	name: string;
	owner: string;
};

const privateConstructorKey = Symbol();

export class Person extends InjectableApi {
	private _name: string;
	private _owner: Login;

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

	static #fromRow(row: SqlPersonRow): Person;
	static #fromRow(row: SqlPersonRow | undefined): Person | undefined;
	static #fromRow(row: SqlPersonRow | undefined) {
		if (!row) {
			return;
		}

		const owner = this.Login.fromUserId(row.id);
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
				owner: owner.userId,
			}) as SqlPersonRow | undefined;

		return this.#fromRow(row);
	}

	static fromId(id: string, owner: Login) {
		const row = this.database
			.prepare(
				`SELECT * FROM people
				WHERE id = :id AND owner = :owner`,
			)
			.get({
				name: id,
				owner: owner.userId,
			}) as SqlPersonRow | undefined;

		return this.#fromRow(row);
	}

	static all(owner: Login) {
		const rows = this.database
			.prepare(
				`SELECT * FROM people
				WHERE owner = :owner`,
			)
			.all({
				owner: owner.userId,
			}) as SqlPersonRow[];

		return rows.map(row => this.#fromRow(row));
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
					owner: owner.userId,
				});
		} catch {
			throw new ApiError(`Person with the same name exists already.`);
		}

		return new this.Person(slug, name, owner, privateConstructorKey);
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
}
