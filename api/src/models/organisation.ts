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

import type {Asset} from './asset.js';

type SqlOrganisationRow = {
	id: string;
	name: string;
	image: string | null;
	website: string | null;
};

const privateConstructorKey = Symbol();

export class Organisation extends InjectableApi {
	private _name: string;
	private _image: Asset | undefined;
	private _website: string | undefined;

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

	toJson() {
		return {
			id: this.id,
			name: this.name,
			image: this.image?.name ?? null,
			website: this.website ?? null,
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
}
