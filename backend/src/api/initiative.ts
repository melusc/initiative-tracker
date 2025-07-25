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
	type ImageAsset,
	type Initiative,
} from '@lusc/initiative-tracker-api';
import {typeOf} from '@lusc/initiative-tracker-util/type-of.js';
import type {ApiResponse} from '@lusc/initiative-tracker-util/types.js';
import {Router, type Request, type RequestHandler} from 'express';

import {api} from '../database.ts';
import {requireAdmin, requireLogin} from '../middleware/login-protect.ts';
import {mergeExpressBodyFile, multerUpload} from '../uploads.ts';
import {
	isEmpty,
	isValidUrl,
	makeValidator,
	sanitiseUrl,
} from '../validate-body.ts';

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
	deadline(input: unknown): ApiResponse<string | undefined> {
		if (isEmpty(input)) {
			return {
				type: 'success',
				data: undefined,
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
	async pdf(pdf: unknown): Promise<ApiResponse<Asset>> {
		if (Buffer.isBuffer(pdf)) {
			try {
				const pdfAsset = await api.PdfAsset.createFromBuffer(pdf);
				return {
					type: 'success',
					data: pdfAsset,
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

		if (typeof pdf === 'string') {
			try {
				const pdfAsset = await api.PdfAsset.createFromUrl(pdf);
				return {
					type: 'success',
					data: pdfAsset,
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
			readableError: 'Invalid pdf.',
			error: 'fetch-error',
		};
	},
	async image(image: unknown): Promise<ApiResponse<ImageAsset | undefined>> {
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
};

const initiativeValidator = makeValidator(initativeKeyValidators);

export async function createInitiative(
	request: Request,
): Promise<ApiResponse<Initiative>> {
	const body = mergeExpressBodyFile(request, ['pdf', 'image']);

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

	const initiative = api.Initiative.create(
		shortName,
		fullName,
		website,
		pdf,
		image,
		deadline,
	);

	return {
		type: 'success',
		data: initiative,
	};
}

const createInitiativeEndpoint: RequestHandler = async (request, response) => {
	const result = await createInitiative(request);

	if (result.type === 'error') {
		response.status(400).json(result);
		return;
	}

	response.status(201).json({
		type: 'success',
		data: result.data,
	});
};

const getInitiative: RequestHandler<{id: string}> = async (
	request,
	response,
) => {
	const id = request.params.id;
	const login = response.locals.login;
	const initiative = await api.Initiative.fromId(id);

	if (!initiative) {
		response.status(404).json({
			type: 'error',
			readableError: 'Initiative does not exist.',
			error: 'not-found',
		});
		return;
	}

	if (login) {
		await initiative.resolveSignaturesOrganisations(login);
	}

	response.status(200).json({
		type: 'success',
		data: initiative,
	});
};

const getAllInitiatives: RequestHandler = async (_request, response) => {
	const initiatives = await api.Initiative.all();
	const login = response.locals.login;
	if (login) {
		for (const initiative of initiatives) {
			await initiative.resolveSignaturesOrganisations(login);
		}
	}

	response.status(200).json({
		type: 'success',
		data: initiatives,
	});
};

const patchInitiative: RequestHandler<{id: string}> = async (
	request,
	response,
) => {
	const {id} = request.params;
	const initiative = await api.Initiative.fromId(id);

	if (!initiative) {
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

	for (const key of Object.keys(newData)) {
		switch (key) {
			case 'shortName': {
				initiative.updateShortName(newData.shortName);
				break;
			}
			case 'fullName': {
				initiative.updateFullName(newData.fullName);
				break;
			}
			case 'deadline': {
				initiative.updateDeadline(newData.deadline);
				break;
			}
			case 'website': {
				initiative.updateWebsite(newData.website);
				break;
			}
			case 'pdf': {
				await initiative.updatePdf(newData.pdf);
				break;
			}
			case 'image': {
				await initiative.updateImage(newData.image);
			}
		}
	}

	const login = response.locals.login;
	if (login) {
		await initiative.resolveSignaturesOrganisations(login);
	}

	response.status(200).send({
		type: 'success',
		data: initiative,
	});
};

const deleteInitiative: RequestHandler<{id: string}> = async (
	request,
	response,
) => {
	const {id} = request.params;

	const initiative = await api.Initiative.fromId(id);
	if (!initiative) {
		response.status(404).json({
			type: 'error',
			readableError: 'Initiative does not exist.',
			error: 'not-found',
		});
		return;
	}

	await initiative.rm();

	response.status(200).json({
		type: 'success',
	});
};

const createModifyInitiativeSignature =
	(
		remove: boolean,
	): RequestHandler<{
		initiativeId: string;
		personId: string;
	}> =>
	async (request, response) => {
		const initiative = await api.Initiative.fromId(request.params.initiativeId);
		const login = response.locals.login!;
		const person = api.Person.fromId(request.params.personId, login);

		if (!initiative || !person) {
			response.status(404).json({
				type: 'error',
				error: 'not-found',
				readableError: 'Initiative or person not found',
			});
			return;
		}

		await person.resolveSignatures();

		if (remove) {
			person.removeSignature(initiative);
		} else {
			person.addSignature(initiative);
		}

		return response.status(201).json({
			type: 'success',
		});
	};

const createModifyInitiativeOrganisation =
	(
		remove: boolean,
	): RequestHandler<{
		initiativeId: string;
		organisationId: string;
	}> =>
	async (request, response) => {
		const initiative = await api.Initiative.fromId(request.params.initiativeId);
		const organisation = await api.Organisation.fromId(
			request.params.organisationId,
		);

		if (!initiative || !organisation) {
			response.status(404).json({
				type: 'error',
				error: 'not-found',
				readableError: 'Initiative or organisation not found',
			});
			return;
		}

		await organisation.resolveInitiatives();

		if (remove) {
			organisation.removeInitiative(initiative);
		} else {
			organisation.addInitiative(initiative);
		}

		return response.status(201).json({
			type: 'success',
		});
	};

export const initiativeRouter = Router();

/* NON-ADMIN */
initiativeRouter.put(
	'/initiative/:initiativeId/sign/:personId',
	requireLogin(),
	createModifyInitiativeSignature(false),
);
initiativeRouter.delete(
	'/initiative/:initiativeId/sign/:personId',
	requireLogin(),
	createModifyInitiativeSignature(true),
);

/* ADMIN (except GET) */
initiativeRouter.get('/initiatives', getAllInitiatives);
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
initiativeRouter.get('/initiative/:id', getInitiative);
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
	patchInitiative,
);

initiativeRouter.put(
	'/initiative/:initiativeId/organisation/:organisationId',
	requireAdmin(),
	createModifyInitiativeOrganisation(false),
);
initiativeRouter.delete(
	'/initiative/:initiativeId/organisation/:organisationId',
	requireAdmin(),
	createModifyInitiativeOrganisation(true),
);
