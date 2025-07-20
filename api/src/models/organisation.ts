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

import type {Asset} from './asset.js';
import type {Initiative, InitiativeJson} from './initiative.js';

type SqlOrganisationRow = {
	id: string;
	name: string;
	image: string | null;
	website: string | null;
};

export type OrganisationJson = {
	id: string;
	name: string;
	image: string | null;
	website: string | null;
	initiatives: InitiativeJson[];
};

const privateConstructorKey = Symbol();

export class Organisation extends InjectableApi {
	private _name: string;
	private _image: Asset | undefined;
	private _website: string | undefined;
	private _initiatives: Initiative[] = [];
	private _initiativesResolved = false;

	constructor(
		readonly id: string,
		name: string,
		image: Asset | undefined,
		website: string | undefined,
		constructorKey: symbol,
	) {
		if (constructorKey !== privateConstructorKey) {
			throw new ApiError('Organisation.constructor is private.');
		}

		super();

		this._name = name;
		this._image = image;
		this._website = website;
	}

	get name() {
		return this._name;
	}

	get image() {
		return this._image;
	}

	get website() {
		return this._website;
	}

	get initiatives() {
		return this._initiatives;
	}

	toJson(): OrganisationJson {
		return {
			id: this.id,
			name: this.name,
			image: this.image?.name ?? null,
			website: this.website ?? null,
			initiatives: this.initiatives.map(initiative => initiative.toJson()),
		};
	}

	private static getOrganisationSlug(name: string) {
		const baseSlug = makeSlug(name, {appendRandomHex: false});

		for (let counter = 0; ; ++counter) {
			const slug = counter === 0 ? baseSlug : `${baseSlug}-${counter}`;

			const initiative = this.database
				.prepare('SELECT id from organisations where id = :slug')
				.get({slug}) as {id: string} | undefined;

			if (!initiative) {
				return slug;
			}
		}
	}

	static create(
		name: string,
		image: Asset | undefined,
		website: string | undefined,
	) {
		const slug = this.getOrganisationSlug(name);
		website ||= undefined;

		const row: SqlOrganisationRow = {
			id: slug,
			name,
			image: image?.name ?? null,
			website: website ?? null,
		};

		this.database
			.prepare(
				`INSERT INTO organisations
				(id, name, image, website)
				VALUES (:id, :name, :image, :website)`,
			)
			.run(row);

		return new this.Organisation(
			slug,
			name,
			image,
			website,
			privateConstructorKey,
		);
	}

	static async #fromRow(row: SqlOrganisationRow): Promise<Organisation>;
	static async #fromRow(
		row: SqlOrganisationRow | undefined,
	): Promise<Organisation | undefined>;
	static async #fromRow(row: SqlOrganisationRow | undefined) {
		if (!row) {
			return;
		}

		const image = row.image ? await this.Asset.fromName(row.image) : undefined;

		return new this.Organisation(
			row.id,
			row.name,
			image,
			row.website ?? undefined,
			privateConstructorKey,
		);
	}

	static all(): Promise<Organisation[]> {
		const result = this.database
			.prepare('SELECT * from organisations')
			.all() as SqlOrganisationRow[];

		return Promise.all(result.map(row => this.#fromRow(row)));
	}

	static fromId(id: string): Promise<Organisation | undefined> {
		const result = this.database
			.prepare('SELECT * from organisations WHERE id = :id')
			.get({
				id,
			}) as SqlOrganisationRow | undefined;

		return this.#fromRow(result);
	}

	// Avoid infinite recursion
	// Only resolve explicitly
	async resolveInitiatives() {
		const initiativeRows = this.database
			.prepare(
				`SELECT initiativeId FROM initiativeOrganisations
				WHERE organisationId = :organisationId`,
			)
			.all({
				organisationId: this.id,
			}) as Array<{initiativeId: string}>;

		const initiatives = (await Promise.all(
			initiativeRows.map(({initiativeId}) =>
				this.Initiative.fromId(initiativeId),
			),
		)) as Array<Initiative>;

		this._initiatives = sortInitiatives(initiatives);
		this._initiativesResolved = true;
	}

	updateName(newName: string) {
		if (newName === this.name) {
			return;
		}

		this.database
			.prepare(
				`UPDATE organisations
				SET name = :name
				WHERE id = :id`,
			)
			.run({
				name: newName,
				id: this.id,
			});

		this._name = newName;
	}

	async updateImage(newImage: Asset | undefined) {
		if (this.image === undefined && newImage === undefined) {
			return;
		}

		this.database
			.prepare(
				`UPDATE organisations
				SET image = :image
				WHERE id = :id`,
			)
			.run({
				image: newImage?.name ?? null,
				id: this.id,
			});

		try {
			await this.image?.rm();
		} catch {}

		this._image = newImage;
	}

	updateWebsite(newWebsite: string | undefined) {
		if (this.website === newWebsite) {
			return;
		}

		this.database
			.prepare(
				`UPDATE organisations
				SET website = :website
				WHERE id = :id`,
			)
			.run({
				website: newWebsite ?? null,
				id: this.id,
			});

		this._website = newWebsite;
	}

	addInitiative(initiative: Initiative) {
		if (!this._initiativesResolved) {
			throw new ApiError('Must initialise initiatives.');
		}

		try {
			this.database
				.prepare(
					`INSERT INTO initiativeOrganisations
					(initiativeId, organisationId)
					VALUES (:initiativeId, :organisationId)`,
				)
				.run({
					initiativeId: initiative.id,
					organisationId: this.id,
				});

			this._initiatives = sortInitiatives([...this.initiatives, initiative]);
		} catch {}
	}

	removeInitiative(initiative: Initiative) {
		if (!this._initiativesResolved) {
			throw new ApiError('Must initialise initiatives.');
		}

		this.database
			.prepare(
				`DELETE FROM initiativeOrganisations
				WHERE organisationId = :organisationId
				AND initiativeId = :initiativeId`,
			)
			.run({
				organisationId: this.id,
				initiativeId: initiative.id,
			});

		this._initiatives = this.initiatives.filter(
			other => other.id !== initiative.id,
		);
	}

	async rm() {
		this.database
			.prepare(
				`DELETE FROM organisations
				WHERE id = :id`,
			)
			.run({
				id: this.id,
			});

		try {
			await this.image?.rm();
		} catch {}
	}
}
