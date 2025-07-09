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

type SqlInitiativeRow = {
	id: string;
	shortName: string;
	fullName: string;
	website: string | null;
	pdf: string;
	image: string | null;
	deadline: string | null;
};

const privateConstructorKey = Symbol();

export class Initiative extends InjectableApi {
	private _shortName: string;
	private _fullName: string;
	private _website: string | undefined;
	private _pdf: Asset;
	private _image: Asset | undefined;
	private _deadline: string | undefined;

	constructor(
		readonly id: string,
		shortName: string,
		fullName: string,
		website: string | undefined,
		pdf: Asset,
		image: Asset | undefined,
		deadline: string | undefined,
		constructorKey: symbol,
	) {
		if (constructorKey !== privateConstructorKey) {
			throw new Error('Initiative.constructor is private.');
		}

		super();

		this._shortName = shortName;
		this._fullName = fullName;
		this._website = website;
		this._pdf = pdf;
		this._image = image;
		this._deadline = deadline;
	}

	get shortName() {
		return this._shortName;
	}

	get fullName() {
		return this._fullName;
	}

	get website() {
		return this._website;
	}

	get pdf() {
		return this._pdf;
	}

	get image() {
		return this._image;
	}

	get deadline() {
		return this._deadline;
	}

	toJson() {
		return {
			id: this.id,
			shortName: this.shortName,
			fullName: this.fullName,
			website: this.website,
			pdf: this.pdf,
			image: this.image,
			deadline: this.deadline,
		};
	}

	private static getInitiativeSlug(name: string) {
		const baseSlug = makeSlug(name, {appendRandomHex: false});

		for (let counter = 0; ; ++counter) {
			const slug = counter === 0 ? baseSlug : `${baseSlug}-${counter}`;

			const initiative = this.database
				.prepare('SELECT id from initiatives where id = :slug')
				.get({slug}) as {id: string} | undefined;

			if (!initiative) {
				return slug;
			}
		}
	}

	static create(
		shortName: string,
		fullName: string,
		website: string | undefined,
		pdf: Asset,
		image: Asset | undefined,
		deadline: string | undefined,
	) {
		website ||= undefined;
		deadline ||= undefined;

		const id = this.getInitiativeSlug(shortName);

		const row = {
			id,
			shortName,
			fullName,
			website: website ?? null,
			pdf: pdf.name,
			image: image?.name ?? null,
			deadline: deadline ?? null,
		};

		this.database
			.prepare(
				`INSERT INTO initiatives
				(id, shortName, fullName, website, pdf, image, deadline)
				VALUES (:id, :shortName, :fullName, :website, :pdf, :image, :deadline)`,
			)
			.run(row);

		return new this.Initiative(
			id,
			shortName,
			fullName,
			website,
			pdf,
			image,
			deadline,
			privateConstructorKey,
		);
	}

	private static async fromRow(row: SqlInitiativeRow): Promise<Initiative>;
	private static async fromRow(
		row: SqlInitiativeRow | undefined,
	): Promise<Initiative | undefined>;
	private static async fromRow(row: SqlInitiativeRow | undefined) {
		if (!row) {
			return;
		}

		const pdf = await this.Asset.fromName(row.pdf);

		if (!pdf) {
			throw new ApiError(`PDF ${row.pdf} does not exist.`);
		}

		const image = row.image ? await this.Asset.fromName(row.image) : undefined;

		return new this.Initiative(
			row.id,
			row.shortName,
			row.fullName,
			row.website ?? undefined,
			pdf,
			image,
			row.deadline ?? undefined,
			privateConstructorKey,
		);
	}

	static all() {
		const result = this.database
			.prepare('SELECT * from initaitives')
			.all() as SqlInitiativeRow[];

		return result.map(row => this.fromRow(row));
	}

	static fromId(id: string) {
		const result = this.database
			.prepare('SELECT * from initiatives WHERE id = :id')
			.get({
				id,
			}) as SqlInitiativeRow | undefined;

		return this.fromRow(result);
	}

	updateShortName(newShortName: string) {
		if (newShortName === this.shortName) {
			return;
		}

		this.database
			.prepare(
				`UPDATE initiatives
			SET shortName = :shortName
			WHERE id = :id`,
			)
			.run({
				shortName: newShortName,
				id: this.id,
			});

		this._shortName = newShortName;
	}

	updateFullName(newFullName: string) {
		if (newFullName === this.fullName) {
			return;
		}

		this.database
			.prepare(
				`UPDATE initiatives
			SET fullName = :fullName
			WHERE id = :id`,
			)
			.run({
				fullName: newFullName,
				id: this.id,
			});

		this._fullName = newFullName;
	}

	updateWebsite(newWebsite: string | undefined) {
		if (newWebsite === this.website) {
			return;
		}

		this.database
			.prepare(
				`UPDATE initiatives
			SET website = :website
			WHERE id = :id`,
			)
			.run({
				website: newWebsite ?? null,
				id: this.id,
			});

		this._website = newWebsite;
	}

	async updatePdf(newPdf: Asset) {
		this.database
			.prepare(
				`UPDATE initiatives
			SET pdf = :pdf
			WHERE id = :id`,
			)
			.run({
				pdf: newPdf.name,
				id: this.id,
			});

		try {
			await this.pdf.rm();
		} catch {}

		this._pdf = newPdf;
	}

	async updateImage(newImage: Asset | undefined) {
		if (newImage === undefined && this.image === undefined) {
			return;
		}

		this.database
			.prepare(
				`UPDATE initiatives
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

	updateDeadline(newDeadline: string | undefined) {
		if (this.deadline === newDeadline) {
			return;
		}

		this.database
			.prepare(
				`UPDATE initiatives
			SET deadline = :deadline
			WHERE id = :id`,
			)
			.run({
				deadline: newDeadline ?? null,
				id: this.id,
			});

		this._deadline = newDeadline;
	}
}
