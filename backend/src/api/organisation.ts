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
import type {ApiResponse} from '@lusc/initiative-tracker-util/types.js';
import {Router, type Request, type RequestHandler} from 'express';

import {api} from '../database.js';
import {requireAdmin} from '../middleware/login-protect.js';
import {mergeExpressBodyFile, multerUpload} from '../uploads.js';
import {
	FieldRequired,
	validateFile,
	validateName,
	validateUrl,
	ValidationError,
} from '../validators.js';

export async function createOrganisation(
	request: Request,
): Promise<ApiResponse<Organisation>> {
	const body = mergeExpressBodyFile(request, ['image']);

	let name: string;
	let image: Buffer | string | undefined;
	let website: string | undefined;

	try {
		name = validateName(body['name'], 'Name', FieldRequired.Required);
		image = validateFile(body['image'], 'Image', FieldRequired.Optional);
		website = validateUrl(body['website'], 'Website', FieldRequired.Optional);
	} catch (error: unknown) {
		return {
			type: 'error',
			error: (error as ValidationError).message,
		};
	}

	let imageAsset: Asset | undefined;

	try {
		if (Buffer.isBuffer(image)) {
			imageAsset = await api.ImageAsset.createFromBuffer(image);
		} else if (image) {
			imageAsset = await api.ImageAsset.createFromUrl(image);
		}
	} catch (error: unknown) {
		let message = 'Unknown error.';
		if (error instanceof ValidationError || error instanceof ApiError) {
			message = error.message;
		} else {
			console.error(error);
		}

		return {
			type: 'error',
			error: message,
		};
	}

	const organisation = api.Organisation.create(name, imageAsset, website);

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
			error: 'Organisation does not exist.',
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
			error: 'Organisation does not exist.',
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
			error: 'Organisation does not exist.',
		});
		return;
	}

	const body = mergeExpressBodyFile(request, ['image']);

	try {
		for (const key of Object.keys(body)) {
			switch (key) {
				case 'name': {
					const name = validateName(
						body['name'],
						'Name',
						FieldRequired.Required,
					);
					organisation.updateName(name);
					break;
				}
				case 'website': {
					const website = validateUrl(
						body['website'],
						'Website',
						FieldRequired.Optional,
					);
					organisation.updateWebsite(website);
					break;
				}
				case 'image': {
					const image = validateFile(
						body['image'],
						'Image',
						FieldRequired.Optional,
					);
					let imageAsset: Asset | undefined;
					if (Buffer.isBuffer(image)) {
						imageAsset = await api.ImageAsset.createFromBuffer(image);
					} else if (image) {
						imageAsset = await api.ImageAsset.createFromUrl(image);
					}
					await organisation.updateImage(imageAsset);
				}
			}
		}
	} catch (error: unknown) {
		let message = 'Unknown error.';
		if (error instanceof ValidationError || error instanceof ApiError) {
			message = error.message;
			response.status(400);
		} else {
			console.error(error);
			response.status(500);
		}

		response.json({
			type: 'error',
			error: message,
		});
		return;
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
