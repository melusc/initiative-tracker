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

import {
	ApiError,
	type Asset,
	type Organisation,
} from '@lusc/initiative-tracker-api';
import {typeOf} from '@lusc/initiative-tracker-util/type-of.js';
import type {ApiResponse} from '@lusc/initiative-tracker-util/types.js';
import {Router, type Request, type RequestHandler} from 'express';

import {api} from '../database.ts';
import {requireAdmin} from '../middleware/login-protect.ts';
import {mergeExpressBodyFile, multerUpload} from '../uploads.ts';
import {
	isEmpty,
	isValidUrl,
	makeValidator,
	sanitiseUrl,
} from '../validate-body.ts';

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
	async image(image: unknown): Promise<ApiResponse<undefined | Asset>> {
		if (isEmpty(image)) {
			return {
				type: 'success',
				data: undefined,
			};
		}

		if (Buffer.isBuffer(image)) {
			try {
				const imageAsset = await api.ImageAsset.createFromBuffer(image);
				return {
					type: 'success',
					data: imageAsset,
				};
			} catch (error: unknown) {
				if (error instanceof ApiError) {
					return {
						type: 'error',
						readableError: error.message,
						error: 'fetch-error',
					};
				}
			}
		}

		if (typeof image === 'string') {
			try {
				const imageAsset = await api.ImageAsset.createFromUrl(image);
				return {
					type: 'success',
					data: imageAsset,
				};
			} catch (error: unknown) {
				if (error instanceof ApiError) {
					return {
						type: 'error',
						readableError: error.message,
						error: 'fetch-error',
					};
				}
			}
		}

		return {
			type: 'error',
			readableError: 'Invalid image.',
			error: 'fetch-error',
		};
	},
	website(website: unknown): ApiResponse<string | undefined> {
		if (isEmpty(website)) {
			return {
				type: 'success',
				data: undefined,
			};
		}

		if (!isValidUrl(website)) {
			return {
				type: 'error',
				readableError: 'Not a valid url.',
				error: 'invalid-url',
			};
		}

		return {
			type: 'success',
			data: sanitiseUrl(website as string),
		};
	},
};

const organisationValidator = makeValidator(organisationKeyValidators);

export async function createOrganisation(
	request: Request,
): Promise<ApiResponse<Organisation>> {
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

	const organisation = api.Organisation.create(name, image, website);

	return {
		type: 'success',
		data: organisation,
	};
}

const createOrganisationEndpoint: RequestHandler = async (
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

const getAllOrganisations: RequestHandler = async (_request, response) => {
	const organisations = await api.Organisation.all();

	for (const organisation of organisations) {
		await organisation.resolveInitiatives();
	}

	response.status(200).json({
		type: 'success',
		data: organisations,
	});
};

const getOrganisation: RequestHandler<{id: string}> = async (
	request,
	response,
) => {
	const organisation = await api.Organisation.fromId(request.params.id);
	if (!organisation) {
		response.status(404).json({
			type: 'error',
			readableError: 'Organisation does not exist.',
			error: 'not-found',
		});
		return;
	}

	await organisation.resolveInitiatives();

	response.status(200).json({
		type: 'success',
		data: organisation,
	});
};

const deleteOrganisation: RequestHandler<{id: string}> = async (
	request,
	response,
) => {
	const {id} = request.params;
	const organisation = await api.Organisation.fromId(id);

	if (!organisation) {
		response.status(404).json({
			type: 'error',
			readableError: 'Organisation does not exist.',
			error: 'not-found',
		});
		return;
	}

	await organisation.rm();

	response.status(200).json({
		type: 'success',
	});
};

const patchOrganisation: RequestHandler<{id: string}> = async (
	request,
	response,
) => {
	const {id} = request.params;

	const organisation = await api.Organisation.fromId(id);

	if (!organisation) {
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
	for (const key of Object.keys(newData)) {
		switch (key) {
			case 'name': {
				organisation.updateName(newData.name);
				break;
			}
			case 'website': {
				organisation.updateWebsite(newData.website);
				break;
			}
			case 'image': {
				await organisation.updateImage(newData.image);
			}
		}
	}

	await organisation.resolveInitiatives();

	response.status(200).send({
		type: 'success',
		data: organisation,
	});
};

export const organisationRouter = Router();

organisationRouter.get('/organisations', getAllOrganisations);
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
organisationRouter.get('/organisation/:id', getOrganisation);
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
