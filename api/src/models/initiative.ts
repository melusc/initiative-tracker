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
	slug: string;
	shortName: string;
	fullName: string;
	website: string | null;
	pdf: string;
	image: string | null;
	deadline: string | null;
	initiatedDate: string | null;
	updatedAt: number;
	createdAt: number;
};

export type InitiativeJson = {
	id: string;
	slug: string;
	shortName: string;
	fullName: string;
	website: string | null;
	pdf: string;
	image: string | null;
	deadline: string | null;
	signatures: PersonJson[];
	organisations: OrganisationJson[];
	initiatedDate: string | null;
	updatedAt: number;
	createdAt: number;
};

const privateConstructorKey = Symbol();

export class Initiative extends InjectableApi {
	private _slug: string;
	private _shortName: string;
	private _fullName: string;
	private _website: string | undefined;
	private _pdf: Asset;
	private _image: Asset | undefined;
	private _deadline: string | undefined;
	private _signatures: Person[] = [];
	private _organisations: Organisation[] = [];
	private _resolvedSignaturesOrganisations = false;
	private _initiatedDate: string | undefined;
	private _updatedAt: number;
	private _createdAt: number;

	constructor(
		readonly id: string,
		slug: string,
		shortName: string,
		fullName: string,
		website: string | undefined,
		pdf: Asset,
		image: Asset | undefined,
		deadline: string | undefined,
		initiatedDate: string | undefined,
		updatedAt: number,
		createdAt: number,
		constructorKey: symbol,
	) {
		if (constructorKey !== privateConstructorKey) {
			throw new ApiError('Initiative.constructor is private.');
		}

		super();

		this._slug = slug;
		this._shortName = shortName;
		this._fullName = fullName;
		this._website = website;
		this._pdf = pdf;
		this._image = image;
		this._deadline = deadline;
		this._initiatedDate = initiatedDate;
		this._updatedAt = updatedAt;
		this._createdAt = createdAt;
	}

	get slug() {
		return this._slug;
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

	get initiatedDate() {
		return this._initiatedDate;
	}

	get updatedAt() {
		return new Date(this._updatedAt);
	}

	get createdAt() {
		return new Date(this._createdAt);
	}

	get signatures() {
		return this._signatures;
	}

	get organisations() {
		return this._organisations;
	}

	toJSON(): InitiativeJson {
		return {
			id: this.id,
			slug: this.slug,
			shortName: this.shortName,
			fullName: this.fullName,
			website: this.website ?? null,
			pdf: this.pdf.name,
			image: this.image?.name ?? null,
			deadline: this.deadline ?? null,
			initiatedDate: this.initiatedDate ?? null,
			updatedAt: this._updatedAt,
			createdAt: this._createdAt,
			signatures: this.signatures.map(signature => signature.toJSON()),
			organisations: this.organisations.map(organisation =>
				organisation.toJSON(),
			),
		};
	}

	private static getInitiativeSlug(name: string, currentId?: string) {
		const baseSlug = makeSlug(name, {appendRandomHex: false});

		for (let counter = 0; ; ++counter) {
			const slug = counter === 0 ? baseSlug : `${baseSlug}-${counter}`;

			const initiative = this.database
				.prepare('SELECT id from initiatives where slug = :slug')
				.get({slug}) as {id: string} | undefined;

			if (!initiative || initiative.id === currentId) {
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
		initiatedDate: string | undefined,
	) {
		website ||= undefined;
		deadline ||= undefined;

		const id = 'i-' + randomBytes(20).toString('base64url');
		const slug = this.getInitiativeSlug(shortName);
		const now = Date.now();

		const row: SqlInitiativeRow = {
			id,
			slug,
			shortName,
			fullName,
			website: website ?? null,
			pdf: pdf.name,
			image: image?.name ?? null,
			deadline: deadline ?? null,
			initiatedDate: initiatedDate ?? null,
			createdAt: now,
			updatedAt: now,
		};

		this.database
			.prepare(
				`INSERT INTO initiatives
					(id, slug, shortName, fullName, website, pdf,
					image, deadline, initiatedDate, createdAt, updatedAt)
				VALUES
					(:id, :slug, :shortName, :fullName, :website, :pdf,
					:image, :deadline, :initiatedDate, :createdAt, :updatedAt)`,
			)
			.run(row);

		return new this.Initiative(
			id,
			slug,
			shortName,
			fullName,
			website,
			pdf,
			image,
			deadline,
			initiatedDate,
			now,
			now,
			privateConstructorKey,
		);
	}

	private static async _fromRow(row: SqlInitiativeRow): Promise<Initiative>;
	private static async _fromRow(
		row: SqlInitiativeRow | undefined,
	): Promise<Initiative | undefined>;
	private static async _fromRow(row: SqlInitiativeRow | undefined) {
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
			row.slug,
			row.shortName,
			row.fullName,
			row.website ?? undefined,
			pdf,
			image,
			row.deadline ?? undefined,
			row.initiatedDate ?? undefined,
			row.updatedAt,
			row.createdAt,
			privateConstructorKey,
		);
	}

	static async all(): Promise<Initiative[]> {
		const result = this.database
			.prepare('SELECT * from initiatives')
			.all() as SqlInitiativeRow[];

		const initiatives = await Promise.all(
			result.map(row => this._fromRow(row)),
		);
		return sortInitiatives(initiatives);
	}

	static async fromId(id: string): Promise<Initiative | undefined> {
		const result = this.database
			.prepare('SELECT * from initiatives WHERE id = :id')
			.get({
				id,
			}) as SqlInitiativeRow | undefined;

		return this._fromRow(result);
	}

	static async fromSlug(slug: string): Promise<Initiative | undefined> {
		const row = this.database
			.prepare('SELECT * from initiatives WHERE slug = :slug')
			.get({
				slug,
			}) as SqlInitiativeRow | undefined;

		return this._fromRow(row);
	}

	updateShortName(newShortName: string) {
		if (newShortName === this.shortName) {
			return;
		}

		const newSlug = this.Initiative.getInitiativeSlug(newShortName, this.id);
		const now = Date.now();

		this.database
			.prepare(
				`UPDATE initiatives
				SET shortName = :shortName,
					slug = :slug,
					updatedAt = :now
				WHERE id = :id`,
			)
			.run({
				shortName: newShortName,
				id: this.id,
				slug: newSlug,
				now,
			});

		this._shortName = newShortName;
		this._slug = newSlug;
		this._updatedAt = now;
	}

	updateFullName(newFullName: string) {
		if (newFullName === this.fullName) {
			return;
		}

		const now = Date.now();

		this.database
			.prepare(
				`UPDATE initiatives
				SET fullName = :fullName,
					updatedAt = :now
				WHERE id = :id`,
			)
			.run({
				fullName: newFullName,
				id: this.id,
				now,
			});

		this._fullName = newFullName;
		this._updatedAt = now;
	}

	updateWebsite(newWebsite: string | undefined) {
		if (newWebsite === this.website) {
			return;
		}

		const now = Date.now();

		this.database
			.prepare(
				`UPDATE initiatives
				SET website = :website,
					updatedAt = :now
				WHERE id = :id`,
			)
			.run({
				website: newWebsite ?? null,
				id: this.id,
				now,
			});

		this._website = newWebsite;
		this._updatedAt = now;
	}

	async updatePdf(newPdf: Asset) {
		const now = Date.now();

		this.database
			.prepare(
				`UPDATE initiatives
				SET pdf = :pdf,
					updatedAt = :now
				WHERE id = :id`,
			)
			.run({
				pdf: newPdf.name,
				id: this.id,
				now,
			});

		try {
			await this.pdf.rm();
		} catch {}

		this._pdf = newPdf;
		this._updatedAt = now;
	}

	async updateImage(newImage: Asset | undefined) {
		if (newImage === undefined && this.image === undefined) {
			return;
		}

		const now = Date.now();

		this.database
			.prepare(
				`UPDATE initiatives
				SET image = :image,
					updatedAt = :now
				WHERE id = :id`,
			)
			.run({
				image: newImage?.name ?? null,
				id: this.id,
				now,
			});

		try {
			await this.image?.rm();
		} catch {}

		this._image = newImage;
		this._updatedAt = now;
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

		const now = Date.now();

		this.database
			.prepare(
				`UPDATE initiatives
				SET deadline = :deadline,
					updatedAt = :now
				WHERE id = :id`,
			)
			.run({
				deadline: newDeadline ?? null,
				id: this.id,
				now,
			});

		this._deadline = newDeadline;
		this._updatedAt = now;
	}

	updateInitiatedDate(newInitiatedDate: string | undefined) {
		if (this.initiatedDate === newInitiatedDate) {
			return;
		}

		const now = Date.now();

		this.database
			.prepare(
				`UPDATE initiatives
				SET initiatedDate = :initiatedDate,
					updatedAt = :now
				WHERE id = :id`,
			)
			.run({
				initiatedDate: newInitiatedDate ?? null,
				id: this.id,
				now,
			});

		this._initiatedDate = newInitiatedDate;
		this._updatedAt = now;
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
					(initiativeId, personId, createdAt)
					VALUES (:initiativeId, :personId, :createdAt)`,
				)
				.run({
					initiativeId: this.id,
					personId: person.id,
					createdAt: Date.now(),
				});

			this._signatures = sortPeople([...this.signatures, person]);
		} catch (error: unknown) {
			console.error(error);
		}
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
					(initiativeId, organisationId, createdAt)
					VALUES (:initiativeId, :organisationId, :createdAt)`,
				)
				.run({
					initiativeId: this.id,
					organisationId: organisation.id,
					createdAt: Date.now(),
				});

			this._organisations = sortOrganisations([
				...this.organisations,
				organisation,
			]);
		} catch (error: unknown) {
			console.error(error);
		}
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
