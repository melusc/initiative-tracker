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

import {Buffer} from 'node:buffer';
import {unlink, writeFile} from 'node:fs/promises';

import {
	sortInitiatives,
	sortOrganisations,
	sortPeople,
} from '@lusc/initiative-tracker-util/sort.js';
import {typeOf} from '@lusc/initiative-tracker-util/type-of.js';
import type {
	Initiative,
	EnrichedInitiative,
	Organisation,
	Person,
	ApiResponse,
} from '@lusc/initiative-tracker-util/types.js';
import {makeSlug} from '@lusc/util/slug';
import {Router, type RequestHandler} from 'express';

import {database} from '../database.ts';
import {requireAdmin, requireLogin} from '../middleware/login-protect.ts';
import {
	fetchImage,
	fetchPdf,
	imageOutDirectory,
	mergeExpressBodyFile,
	multerUpload,
	pdfOutDirectory,
	transformInitiativeUrls,
	transformOrganisationUrls,
	type FetchedFile,
} from '../uploads.ts';
import {isEmpty, makeValidator, validateUrl} from '../validate-body.ts';

const initativeKeyValidators = {
	shortName(shortName: unknown): ApiResponse<string> {
		if (typeof shortName !== 'string') {
			return {
				type: 'error',
				readableError: `Invalid type for shortName. Expected string, got ${typeOf(shortName)}`,
				error: 'invalid-type',
			};
		}

		if (shortName.length < 10) {
			return {
				type: 'error',
				readableError:
					'Short Name is too short. Must be at least 10 characters.',
				error: 'short-name-too-short',
			};
		}

		return {
			type: 'success',
			data: shortName,
		};
	},
	fullName(fullName: unknown): ApiResponse<string> {
		if (typeof fullName !== 'string') {
			return {
				type: 'error',
				readableError: `Invalid type for fullName. Expected string, got ${typeOf(fullName)}`,
				error: 'invalid-type',
			};
		}

		if (fullName.length < 10) {
			return {
				type: 'error',
				readableError:
					'Full Name is too short. Must be at least 10 characters.',
				error: 'full-name-too-short',
			};
		}

		return {
			type: 'success',
			data: fullName,
		};
	},
	async website(website: unknown): Promise<ApiResponse<string | null>> {
		if (isEmpty(website)) {
			return {
				type: 'success',
				data: null,
			};
		}

		const isValidUrl = await validateUrl('website', website);
		if (isValidUrl.type === 'error') {
			return isValidUrl;
		}

		const websiteUrl = new URL(isValidUrl.data);
		websiteUrl.hash = '';
		websiteUrl.username = '';
		websiteUrl.password = '';

		return {
			type: 'success',
			data: websiteUrl.href,
		};
	},
	deadline(input: unknown): ApiResponse<string | null> {
		if (isEmpty(input)) {
			return {
				type: 'success',
				data: null,
			};
		}

		if (typeof input !== 'string') {
			return {
				type: 'error',
				readableError: `Invalid type for deadline. Expected number, got ${typeOf(input)}`,
				error: 'invalid-type',
			};
		}

		const deadline = input.trim();

		const date = new Date(deadline);
		if (Number.isNaN(date.getTime())) {
			return {
				type: 'error',
				readableError: 'Invalid date.',
				error: 'invalid-date',
			};
		}

		const stringified = date.toISOString().slice(0, 'YYYY-MM-DD'.length);
		if (stringified !== deadline) {
			return {
				type: 'error',
				readableError: `Invalid date. Normalising input "${deadline}" resulted in "${stringified}". Expected it to stay unchanged`,
				error: 'invalid-date',
			};
		}

		return {
			type: 'success',
			data: deadline,
		};
	},
	async pdf(pdf: unknown): Promise<ApiResponse<FetchedFile>> {
		try {
			if (Buffer.isBuffer(pdf)) {
				const localPdf = await fetchPdf(pdf);
				return {
					type: 'success',
					data: localPdf,
				};
			}

			const isValidUrl = await validateUrl('PDF URL', pdf);
			if (isValidUrl.type === 'error') {
				return isValidUrl;
			}

			const localPdf = await fetchPdf(new URL(isValidUrl.data));

			return {
				type: 'success',
				data: localPdf,
			};
		} catch {
			return {
				type: 'error',
				readableError: 'Could not fetch PDF. Either invalid URL or not a PDF.',
				error: 'fetch-error',
			};
		}
	},
	async image(image: unknown): Promise<ApiResponse<FetchedFile | null>> {
		if (isEmpty(image)) {
			return {
				type: 'success',
				data: null,
			};
		}

		try {
			if (Buffer.isBuffer(image)) {
				const localImage = await fetchImage(image);
				return {
					type: 'success',
					data: localImage,
				};
			}

			const isValidUrl = await validateUrl('image URL', image);
			if (isValidUrl.type === 'error') {
				return isValidUrl;
			}

			const localImage = await fetchImage(new URL(isValidUrl.data));

			return {
				type: 'success',
				data: localImage,
			};
		} catch {
			return {
				type: 'error',
				readableError:
					'Could not fetch image. Either it was an invalid URL or the file was not an image.',
				error: 'fetch-error',
			};
		}
	},
};

const initiativeValidator = makeValidator(initativeKeyValidators);

function findAvailableInitiativeSlug(name: string): string {
	const baseSlug = makeSlug(name, {appendRandomHex: false});

	for (let counter = 0; ; ++counter) {
		const slug = counter === 0 ? baseSlug : `${baseSlug}-${counter}`;

		const initiative = database
			.prepare('SELECT id from initiatives where id = :slug')
			.get({slug}) as {id: string} | undefined;

		if (!initiative) {
			return slug;
		}
	}
}

export async function createInitiative(
	loginUserId: string,
	body: Record<string, unknown>,
): Promise<ApiResponse<EnrichedInitiative>> {
	const validateResult = await initiativeValidator(body, [
		'shortName',
		'fullName',
		'website',
		'pdf',
		'image',
		'deadline',
	]);

	if (validateResult.type === 'error') {
		return validateResult;
	}

	const {website, fullName, shortName, pdf, image, deadline} =
		validateResult.data;

	// eslint-disable-next-line security/detect-non-literal-fs-filename
	await writeFile(pdf.suggestedFilePath, pdf.body);

	if (image) {
		// eslint-disable-next-line security/detect-non-literal-fs-filename
		await writeFile(image.suggestedFilePath, image.body);
	}

	const id = findAvailableInitiativeSlug(shortName);

	const result: Initiative = {
		id,
		shortName,
		fullName,
		website,
		pdf: pdf.id,
		image: image?.id ?? null,
		deadline,
	};

	database
		.prepare(
			`INSERT INTO initiatives
			(id, shortName, fullName, website, pdf, image, deadline)
			VALUES (:id, :shortName, :fullName, :website, :pdf, :image, :deadline)`,
		)
		.run(result);

	return {
		type: 'success',
		data: enrichInitiative(transformInitiativeUrls(result), loginUserId),
	};
}

export const createInitiativeEndpoint: RequestHandler = async (
	request,
	response,
) => {
	const body = mergeExpressBodyFile(request, ['pdf', 'image']);

	const result = await createInitiative(response.locals.login!.id, body);

	if (result.type === 'error') {
		response.status(400).json(result);
		return;
	}

	response.status(201).json(result);
};

export function getInitiative(
	id: string,
	loginUserId: string | undefined,
): EnrichedInitiative | Initiative | false {
	const initiative = database
		.prepare('SELECT initiatives.* from initiatives where id = :id')
		.get({id}) as Initiative | undefined;

	if (!initiative) {
		return false;
	}

	return enrichInitiative(transformInitiativeUrls(initiative), loginUserId);
}

export const getInitiativeEndpoint: RequestHandler<{id: string}> = (
	request,
	response,
) => {
	const initiative = getInitiative(
		request.params.id,
		response.locals.login?.id,
	);

	if (!initiative) {
		response.status(404).json({
			type: 'error',
			readableError: 'Initiative does not exist.',
			error: 'not-found',
		});
		return;
	}

	response.status(200).json({
		type: 'success',
		data: initiative,
	});
};

function enrichInitiative(
	initiative: Initiative,
	loginUserId: string | undefined,
): EnrichedInitiative {
	const people =
		loginUserId === undefined
			? null
			: (database
					.prepare(
						`SELECT people.* FROM people
			INNER JOIN signatures on signatures.personId = people.id
			WHERE signatures.initiativeId = :initiativeId
			AND people.owner = :loginUserId`,
					)
					.all({initiativeId: initiative.id, loginUserId}) as Person[]);

	const organisations = database
		.prepare(
			`SELECT organisations.* FROM organisations
				INNER JOIN initiativeOrganisations ON organisations.id = initiativeOrganisations.organisationId
				WHERE initiativeOrganisations.initiativeId = :initiativeId`,
		)
		.all({initiativeId: initiative.id}) as Organisation[];

	return {
		...initiative,
		signatures: people && sortPeople(people),
		organisations: sortOrganisations(organisations).map(organisation =>
			transformOrganisationUrls(organisation),
		),
	};
}

export function getAllInitiatives(
	loginUserId: string | undefined,
): EnrichedInitiative[] {
	const rows = database
		.prepare('SELECT initiatives.* FROM initiatives')
		.all() as Initiative[];

	return sortInitiatives(rows).map(initiative =>
		enrichInitiative(transformInitiativeUrls(initiative), loginUserId),
	);
}

export const getAllInitiativesEndpoint: RequestHandler = (
	_request,
	response,
) => {
	response.status(200).json({
		type: 'success',
		data: getAllInitiatives(response.locals.login?.id),
	});
};

export const patchInitiativeEndpoint: RequestHandler<{id: string}> = async (
	request,
	response,
) => {
	const {id} = request.params;

	const oldRow = database
		.prepare('SELECT initiatives.* FROM initiatives WHERE id = :id')
		.get({id}) as Initiative | undefined;

	if (!oldRow) {
		response.status(404).json({
			type: 'error',
			readableError: 'Initiative does not exist.',
			error: 'not-found',
		});
		return;
	}

	const body = mergeExpressBodyFile(request, ['pdf', 'image']);

	const validateResult = await initiativeValidator(
		body,
		Object.keys(body) as Array<keyof typeof initativeKeyValidators>,
	);

	if (validateResult.type === 'error') {
		response.status(400).json(validateResult);
		return;
	}

	const newData = validateResult.data;
	const newPdf = newData.pdf as FetchedFile | undefined;

	if (newPdf) {
		try {
			// eslint-disable-next-line security/detect-non-literal-fs-filename
			await unlink(new URL(oldRow.pdf, pdfOutDirectory));
		} catch {}

		// eslint-disable-next-line security/detect-non-literal-fs-filename
		await writeFile(newPdf.suggestedFilePath, newPdf.body);
	}

	// .image may be `null`
	// in that case remove old image, no new image
	if ('image' in newData) {
		try {
			if (oldRow.image) {
				// eslint-disable-next-line security/detect-non-literal-fs-filename
				await unlink(new URL(oldRow.image, imageOutDirectory));
			}
		} catch {}

		if (newData.image) {
			// eslint-disable-next-line security/detect-non-literal-fs-filename
			await writeFile(newData.image.suggestedFilePath, newData.image.body);
		}
	}

	if (Object.keys(newData).length === 0) {
		response.status(200).json({
			type: 'success',
			data: enrichInitiative(
				transformInitiativeUrls(oldRow),
				response.locals.login!.id,
			),
		});
		return;
	}

	const query = [];
	const parameters: Record<string, string | null> = {
		id,
	};

	for (const [key, value] of Object.entries(newData)) {
		query.push(`${key} = :${key}`);

		if (key === 'pdf') {
			parameters['pdf'] = newData.pdf.id;
		} else if (key === 'image') {
			parameters['image'] = newData.image?.id ?? null;
		} else {
			parameters[key] = value as string | null;
		}
	}

	database
		.prepare(`UPDATE initiatives SET ${query.join(', ')} WHERE id = :id`)
		.run(parameters);

	response.status(200).send({
		type: 'success',
		data: getInitiative(id, response.locals.login!.id),
	});
};

export const deleteInitiative: RequestHandler<{id: string}> = async (
	request,
	response,
) => {
	const {id} = request.params;

	const oldRow = database
		.prepare('SELECT pdf, image FROM initiatives WHERE id = :id')
		.get({id}) as {pdf: string; image: string} | undefined;

	if (!oldRow) {
		response.status(404).json({
			type: 'error',
			readableError: 'Initiative does not exist.',
			error: 'not-found',
		});
		return;
	}

	try {
		// eslint-disable-next-line security/detect-non-literal-fs-filename
		await unlink(new URL(oldRow.pdf, pdfOutDirectory));
	} catch {}

	try {
		// eslint-disable-next-line security/detect-non-literal-fs-filename
		await unlink(new URL(oldRow.image, imageOutDirectory));
	} catch {}

	database.prepare('DELETE FROM initiatives WHERE id = :id').run({id});

	response.status(200).json({
		type: 'success',
	});
};

export const initiativeAddSignature: RequestHandler<{
	initiativeId: string;
	personId: string;
}> = (request, response) => {
	try {
		database
			.prepare(
				'INSERT INTO signatures (initiativeId, personId) values (:initiativeId, :personId);',
			)
			.run(request.params);
		response.status(201).json({
			type: 'success',
		});
	} catch {
		response.status(404).json({
			type: 'error',
			error: 'not-found',
			readableError: 'Initiative or person not found',
		});
	}
};

export const initiativeRemoveSignature: RequestHandler<{
	initiativeId: string;
	personId: string;
}> = (request, response) => {
	const result = database
		.prepare(
			'DELETE FROM signatures where initiativeId = :initiativeId AND personId = :personId;',
		)
		.run(request.params);

	if (result.changes === 0) {
		response.status(404).json({
			type: 'error',
			readableError: 'Signature does not exist.',
			error: 'not-found',
		});
		return;
	}

	response.status(200).json({
		type: 'success',
	});
};

export const initiativeAddOrganisation: RequestHandler<{
	initiativeId: string;
	organisationId: string;
}> = (request, response) => {
	database
		.prepare(
			'INSERT INTO initiativeOrganisations (initiativeId, organisationId) values (:initiativeId, :organisationId);',
		)
		.run(request.params);

	response.status(201).json({
		type: 'success',
	});
};

export const initiativeRemoveOrganisation: RequestHandler<{
	initiativeId: string;
	organisationId: string;
}> = (request, response) => {
	const result = database
		.prepare(
			'DELETE FROM initiativeOrganisations where initiativeId = :initiativeId AND organisationId = :organisationId;',
		)
		.run(request.params);

	if (result.changes === 0) {
		response.status(404).json({
			type: 'error',
			readableError: "Organisation wasn't associated with initiative.",
			error: 'not-found',
		});
		return;
	}

	response.status(200).json({
		type: 'success',
	});
};

export const initiativeRouter = Router();

/* NON-ADMIN */
initiativeRouter.put(
	'/initiative/:initiativeId/sign/:personId',
	requireLogin(),
	initiativeAddSignature,
);
initiativeRouter.delete(
	'/initiative/:initiativeId/sign/:personId',
	requireLogin(),
	initiativeRemoveSignature,
);

/* ADMIN (except GET) */
initiativeRouter.get('/initiatives', getAllInitiativesEndpoint);
initiativeRouter.post(
	'/initiative/create',
	requireAdmin(),
	multerUpload.fields([
		{
			name: 'pdf',
			maxCount: 1,
		},
		{
			name: 'image',
			maxCount: 1,
		},
	]),
	createInitiativeEndpoint,
);
initiativeRouter.get('/initiative/:id', getInitiativeEndpoint);
initiativeRouter.delete('/initiative/:id', requireAdmin(), deleteInitiative);
initiativeRouter.patch(
	'/initiative/:id',
	requireAdmin(),
	multerUpload.fields([
		{
			name: 'pdf',
			maxCount: 1,
		},
		{
			name: 'image',
			maxCount: 1,
		},
	]),
	patchInitiativeEndpoint,
);

initiativeRouter.put(
	'/initiative/:initiativeId/organisation/:organisationId',
	requireAdmin(),
	initiativeAddOrganisation,
);
initiativeRouter.delete(
	'/initiative/:initiativeId/organisation/:organisationId',
	requireAdmin(),
	initiativeRemoveOrganisation,
);
