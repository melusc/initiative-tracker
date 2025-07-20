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

import {
	sortOrganisations,
	sortPeople,
} from '@lusc/initiative-tracker-util/sort.js';
import {makeSlug} from '@lusc/util/slug';

import {ApiError} from '../error.js';
import {InjectableApi} from '../injectable-api.js';

import type {Asset} from './asset.js';
import type {Login} from './login.js';
import type {Organisation, OrganisationJson} from './organisation.js';
import type {Person, PersonJson} from './person.js';

type SqlInitiativeRow = {
	id: string;
	shortName: string;
	fullName: string;
	website: string | null;
	pdf: string;
	image: string | null;
	deadline: string | null;
};

export type InitiativeJson = {
	id: string;
	shortName: string;
	fullName: string;
	website: string | null;
	pdf: string;
	image: string | null;
	deadline: string | null;
	signatures: PersonJson[];
	organisations: OrganisationJson[];
};

const privateConstructorKey = Symbol();

export class Initiative extends InjectableApi {
	private _shortName: string;
	private _fullName: string;
	private _website: string | undefined;
	private _pdf: Asset;
	private _image: Asset | undefined;
	private _deadline: string | undefined;
	private _signatures: Person[] = [];
	private _organisations: Organisation[] = [];
	private _resolvedSignaturesOrganisations = false;

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
			throw new ApiError('Initiative.constructor is private.');
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

	get signatures() {
		return this._signatures;
	}

	get organisations() {
		return this._organisations;
	}

	toJson(): InitiativeJson {
		return {
			id: this.id,
			shortName: this.shortName,
			fullName: this.fullName,
			website: this.website ?? null,
			pdf: this.pdf.name,
			image: this.image?.name ?? null,
			deadline: this.deadline ?? null,
			signatures: this.signatures.map(signature => signature.toJson()),
			organisations: this.organisations.map(organisation =>
				organisation.toJson(),
			),
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

		const row: SqlInitiativeRow = {
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

	static async #fromRow(row: SqlInitiativeRow): Promise<Initiative>;
	static async #fromRow(
		row: SqlInitiativeRow | undefined,
	): Promise<Initiative | undefined>;
	static async #fromRow(row: SqlInitiativeRow | undefined) {
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

	static async all(): Promise<Initiative[]> {
		const result = this.database
			.prepare('SELECT * from initaitives')
			.all() as SqlInitiativeRow[];

		return Promise.all(result.map(row => this.#fromRow(row)));
	}

	static async fromId(id: string): Promise<Initiative | undefined> {
		const result = this.database
			.prepare('SELECT * from initiatives WHERE id = :id')
			.get({
				id,
			}) as SqlInitiativeRow | undefined;

		return this.#fromRow(result);
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

	async resolveSignaturesOrganisations(owner: Login) {
		const signatureRows = this.database
			.prepare(
				`SELECT personId FROM signatures
			WHERE initiativeId = :initiativeId`,
			)
			.all({
				initiativeId: this.id,
			}) as Array<{personId: string}>;

		const signatures = signatureRows
			.map(({personId}) => this.Person.fromId(personId, owner))
			.filter(person => person !== undefined);

		this._signatures = sortPeople(signatures);

		const organisationRows = this.database
			.prepare(
				`SELECT organisationId FROM initiativeOrganisations
			WHERE initiativeId = :initiativeId`,
			)
			.all({
				initiativeId: this.id,
			}) as Array<{organisationId: string}>;

		const organisations = (await Promise.all(
			organisationRows.map(({organisationId}) =>
				this.Organisation.fromId(organisationId),
			),
		)) as Array<Organisation>;

		this._organisations = sortOrganisations(organisations);

		this._resolvedSignaturesOrganisations = true;
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

	async rm() {
		this.database
			.prepare(
				`DELETE FROM initiatives
				WHERE id = :id`,
			)
			.run({
				id: this.id,
			});

		try {
			await this.image?.rm();
		} catch {}

		try {
			await this.pdf.rm();
		} catch {}
	}

	addSignature(person: Person) {
		if (!this._resolvedSignaturesOrganisations) {
			throw new ApiError('Must initialise signatures and organisations.');
		}

		try {
			this.database
				.prepare(
					`INSERT INTO signatures
					(initiativeId, personId)
					VALUES (:initiativeId, :personId)`,
				)
				.run({
					initiativeId: this.id,
					personId: person.id,
				});

			this._signatures = sortPeople([...this.signatures, person]);
		} catch {}
	}

	removeSignature(person: Person) {
		if (!this._resolvedSignaturesOrganisations) {
			throw new ApiError('Must initialise signatures and organisations.');
		}

		this.database
			.prepare(
				`DELETE FROM signatures
				WHERE initiativeId = :initiativeId
				AND personId = :personId`,
			)
			.run({
				initiativeId: this.id,
				personId: person.id,
			});

		this._signatures = this._signatures.filter(other => other.id !== person.id);
	}

	addOrganisation(organisation: Organisation) {
		if (!this._resolvedSignaturesOrganisations) {
			throw new ApiError('Must initialise signatures and organisations.');
		}

		try {
			this.database
				.prepare(
					`INSERT INTO initiativeOrganisations
					WHERE initiativeId = :initiativeId
					AND organisationId = :organisationId`,
				)
				.run({
					initiativeId: this.id,
					organisationId: organisation.id,
				});

			this._organisations = sortOrganisations([
				...this.organisations,
				organisation,
			]);
		} catch {}
	}

	removeOrganisation(organisation: Organisation) {
		if (!this._resolvedSignaturesOrganisations) {
			throw new ApiError('Must initialise signatures and organisations.');
		}

		this.database
			.prepare(
				`DELETE FROM initiativeOrganisations
				WHERE initiativeId = :initiativeId
				AND organisationId = :organisationId`,
			)
			.run({
				initiativeId: this.id,
				organisationId: organisation.id,
			});

		this._organisations = this.organisations.filter(
			other => other.id !== organisation.id,
		);
	}
}
