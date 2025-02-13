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

import {makeSlug} from '@lusc/initiative-tracker-util/slug.js';
import {
	sortInitiatives,
	sortOrganisations,
} from '@lusc/initiative-tracker-util/sort.js';
import {typeOf} from '@lusc/initiative-tracker-util/type-of.js';
import type {
	Initiative,
	Organisation,
	EnrichedOrganisation,
	ApiResponse,
} from '@lusc/initiative-tracker-util/types.js';
import {Router, type Request, type RequestHandler} from 'express';

import {database} from '../database.ts';
import {requireAdmin} from '../middle-ware/require-admin.ts';
import {
	fetchImage,
	imageOutDirectory,
	mergeExpressBodyFile,
	multerUpload,
	transformInitiativeUrls,
	transformOrganisationUrls,
	type FetchedFile,
} from '../uploads.ts';
import {isNullish, makeValidator, validateUrl} from '../validate-body.ts';

function enrichOrganisation(organisation: Organisation): EnrichedOrganisation {
	const id = organisation.id;

	const initiatives = database
		.prepare(
			`SELECT initiatives.* FROM initiatives
			INNER JOIN initiativeOrganisations
			ON initiativeOrganisations.initiativeId = initiatives.id
			WHERE initiativeOrganisations.organisationId = :organisationId`,
		)
		.all({organisationId: id}) as Initiative[];

	return {
		...organisation,
		signatures: sortInitiatives(initiatives).map(initiative =>
			transformInitiativeUrls(initiative),
		),
	};
}

const organisationKeyValidators = {
	name(nameRaw: unknown): ApiResponse<string> {
		if (typeof nameRaw !== 'string') {
			return {
				type: 'error',
				readableError: `Invalid type for name. Expected string, got ${typeOf(nameRaw)}`,
				error: 'invalid-type',
			};
		}

		const name = nameRaw.trim();

		if (name.length < 4) {
			return {
				type: 'error',
				readableError: 'Name must be at least four characters long',
				error: 'name-too-short',
			};
		}

		if (!/^[a-züöäéèëï][a-züöäéèëï\d\-/()* .]+$/i.test(name)) {
			return {
				type: 'error',
				readableError: 'Name must contain only latin letters.',
				error: 'name-invalid-characters',
			};
		}

		return {
			type: 'success',
			data: name,
		};
	},
	async image(image: unknown): Promise<ApiResponse<null | FetchedFile>> {
		if (isNullish(image)) {
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

			const isValidUrl = await validateUrl('Image URL', image);
			if (isValidUrl.type === 'error') {
				return isValidUrl;
			}

			const localImage = await fetchImage(new URL(image as string));

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

	async website(website: unknown): Promise<ApiResponse<string | null>> {
		if (isNullish(website)) {
			return {
				type: 'success',
				data: null,
			};
		}

		const isValidUrl = await validateUrl('website', website);
		if (isValidUrl.type === 'error') {
			return isValidUrl;
		}

		const websiteUrl = new URL(website as string);
		websiteUrl.hash = '';
		websiteUrl.username = '';
		websiteUrl.password = '';

		return {
			type: 'success',
			data: websiteUrl.href,
		};
	},
};

const organisationValidator = makeValidator(organisationKeyValidators);

export async function createOrganisation(
	request: Request,
): Promise<ApiResponse<EnrichedOrganisation>> {
	const body = mergeExpressBodyFile(request, ['image']);

	const result = await organisationValidator(body, [
		'name',
		'image',
		'website',
	]);

	if (result.type === 'error') {
		return result;
	}

	const {name, image, website} = result.data;
	if (image) {
		await writeFile(image.suggestedFilePath, image.body);
	}

	const id = makeSlug(name);
	const organisation: Organisation = {
		id,
		name,
		image: image ? image.id : image,
		website,
	};

	database
		.prepare(
			`
		INSERT INTO organisations (id, name, image, website)
		values (:id, :name, :image, :website)
	`,
		)
		.run(organisation);

	return {
		type: 'success',
		data: enrichOrganisation(transformOrganisationUrls(organisation)),
	};
}

export const createOrganisationEndpoint: RequestHandler = async (
	request,
	response,
) => {
	const result = await createOrganisation(request);

	if (result.type === 'error') {
		response.status(400).json(result);
		return;
	}

	response.status(201).json(result);
};

export function getAllOrganisations() {
	const rows = database
		.prepare('SELECT id, name, image, website FROM organisations')
		.all() as Organisation[];

	return sortOrganisations(rows).map(organisation =>
		enrichOrganisation(transformOrganisationUrls(organisation)),
	);
}

export const getAllOrganisationsEndpoint: RequestHandler = (
	_request,
	response,
) => {
	response.status(200).json({
		type: 'success',
		data: getAllOrganisations(),
	});
};

export function getOrganisation(id: string) {
	const organisation = database
		.prepare(
			'SELECT id, name, website, image FROM organisations WHERE id = :id',
		)
		.get({
			id,
		}) as Organisation | undefined;

	if (!organisation) {
		return false;
	}

	return enrichOrganisation(transformOrganisationUrls(organisation));
}

export const getOrganisationEndpoint: RequestHandler<{id: string}> = (
	request,
	response,
) => {
	const result = getOrganisation(request.params.id);
	if (!result) {
		return response.status(404).json({
			type: 'error',
			readableError: 'Organisation does not exist.',
			error: 'not-found',
		});
	}

	return response.status(200).json({
		type: 'success',
		data: result,
	});
};

export const deleteOrganisation: RequestHandler<{id: string}> = (
	request,
	response,
) => {
	const {id} = request.params;

	const result = database
		.prepare('DELETE FROM organisations WHERE id = :id')
		.run({id});

	if (result.changes === 0) {
		response.status(404).json({
			type: 'error',
			readableError: 'Organisation does not exist.',
			error: 'not-found',
		});
		return;
	}

	response.status(200).json({
		type: 'success',
	});
};

export const patchOrganisation: RequestHandler<{id: string}> = async (
	request,
	response,
) => {
	const {id} = request.params;

	const oldRow = database
		.prepare(
			'SELECT id, name, image, website FROM organisations WHERE id = :id',
		)
		.get({id}) as Organisation | undefined;

	if (!oldRow) {
		response.status(404).json({
			type: 'error',
			readableError: 'Organisation does not exist.',
			error: 'not-found',
		});
		return;
	}

	const body = mergeExpressBodyFile(request, ['image']);

	const validateResult = await organisationValidator(
		body,
		Object.keys(body) as Array<keyof typeof organisationKeyValidators>,
	);

	if (validateResult.type === 'error') {
		response.status(400).json(validateResult);
		return;
	}

	const newData = validateResult.data;

	if ('image' in newData && oldRow.image !== null) {
		try {
			await unlink(new URL(oldRow.image, imageOutDirectory));
		} catch {}
	}

	if (newData.image) {
		await writeFile(newData.image.suggestedFilePath, newData.image.body);
	}

	if (Object.keys(newData).length === 0) {
		response.status(200).json({
			type: 'success',
			data: enrichOrganisation(transformOrganisationUrls(oldRow)),
		});
		return;
	}

	const query = [];

	for (const key of Object.keys(newData)) {
		query.push(`${key} = :${key}`);
	}

	database
		.prepare(`UPDATE organisations SET ${query.join(', ')} WHERE id = :id`)
		.run({
			...newData,
			id,
			image: newData.image ? newData.image.id : null,
		});

	response.status(200).send({
		type: 'success',
		data: transformOrganisationUrls({
			...oldRow,
			...newData,
			image: newData.image ? newData.image.id : null,
		}),
	});
};

export const organisationRouter = Router();

organisationRouter.get('/organisations', getAllOrganisationsEndpoint);
organisationRouter.post(
	'/organisation/create',
	requireAdmin(),
	multerUpload.fields([
		{
			name: 'image',
			maxCount: 1,
		},
	]),
	createOrganisationEndpoint,
);
organisationRouter.get('/organisation/:id', getOrganisationEndpoint);
organisationRouter.delete(
	'/organisation/:id',
	requireAdmin(),
	deleteOrganisation,
);
organisationRouter.patch(
	'/organisation/:id',
	requireAdmin(),
	multerUpload.fields([
		{
			name: 'image',
			maxCount: 1,
		},
	]),
	patchOrganisation,
);
