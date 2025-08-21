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
	type Initiative,
} from '@lusc/initiative-tracker-api';
import type {ApiResponse} from '@lusc/initiative-tracker-util/types.js';
import {Router, type Request, type RequestHandler} from 'express';

import {api} from '../database.js';
import {requireAdmin, requireLogin} from '../middleware/login-protect.js';
import {mergeExpressBodyFile, multerUpload} from '../uploads.js';
import {
	validateDate,
	validateFile,
	validateName,
	validateWebsite,
	ValidationError,
} from '../validators.js';

export async function createInitiative(
	request: Request,
): Promise<ApiResponse<Initiative>> {
	const body = mergeExpressBodyFile(request, ['pdf', 'image']);

	let shortName: string;
	let fullName: string;
	let website: string | undefined;
	let pdf: string | Buffer;
	let image: string | Buffer | undefined;
	let deadline: string | undefined;
	let initiated: string | undefined;

	try {
		shortName = validateName(body['shortName'], 'Short Name', false);
		fullName = validateName(body['fullName'], 'Full Name', false);
		website = validateWebsite(body['website'], true);
		pdf = validateFile(body['pdf'], 'PDF', false);
		image = validateFile(body['image'], 'Image', true);
		deadline = validateDate(body['deadline'], 'Deadline', true);
		initiated = validateDate(body['initiatedDate'], 'Initiated', true);
	} catch (error: unknown) {
		let message = 'Unknown error.';

		if (error instanceof ApiError || error instanceof ValidationError) {
			message = error.message;
		} else {
			console.error(error);
		}

		return {
			type: 'error',
			error: message,
		};
	}

	let pdfAsset: Asset;
	let imageAsset: Asset | undefined;
	try {
		pdfAsset = await (Buffer.isBuffer(pdf)
			? api.PdfAsset.createFromBuffer(pdf)
			: api.PdfAsset.createFromUrl(pdf));

		if (Buffer.isBuffer(image)) {
			imageAsset = await api.ImageAsset.createFromBuffer(image);
		} else if (image) {
			imageAsset = await api.ImageAsset.createFromUrl(image);
		}
	} catch (error: unknown) {
		try {
			// If image was not valid, delete pdf
			// to avoid orphaned pdfs
			// eslint-disable-next-line @typescript-eslint/no-extra-non-null-assertion, @typescript-eslint/no-unnecessary-condition
			await pdfAsset!?.rm();
		} catch {}

		let message = 'Unknown error.';

		if (error instanceof ApiError || error instanceof ValidationError) {
			message = error.message;
		} else {
			console.error(error);
		}

		return {
			type: 'error',
			error: message,
		};
	}

	const initiative = api.Initiative.create(
		shortName,
		fullName,
		website,
		pdfAsset,
		imageAsset,
		deadline,
		initiated,
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
			error: 'Initiative does not exist.',
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
			error: 'Initiative does not exist.',
		});
		return;
	}

	const body = mergeExpressBodyFile(request, ['pdf', 'image']);

	try {
		for (const key of Object.keys(body)) {
			switch (key) {
				case 'shortName': {
					const shortName = validateName(
						body['shortName'],
						'Short Name',
						false,
					);
					initiative.updateShortName(shortName);
					break;
				}
				case 'fullName': {
					const fullName = validateName(body['fullName'], 'Full Name', false);
					initiative.updateFullName(fullName);
					break;
				}
				case 'deadline': {
					const deadline = validateDate(body['deadline'], 'Deadline', true);
					initiative.updateDeadline(deadline);
					break;
				}
				case 'initiatedDate': {
					const initiated = validateDate(
						body['initiatedDate'],
						'Initiated',
						true,
					);
					initiative.updateInitiatedDate(initiated);
					break;
				}
				case 'website': {
					const website = validateWebsite(body['website'], true);
					initiative.updateWebsite(website);
					break;
				}
				case 'pdf': {
					const pdf = validateFile(body['pdf'], 'PDF', false);
					const pdfAsset = await (Buffer.isBuffer(pdf)
						? api.PdfAsset.createFromBuffer(pdf)
						: api.PdfAsset.createFromUrl(pdf));

					await initiative.updatePdf(pdfAsset);
					break;
				}
				case 'image': {
					const image = validateFile(body['image'], 'Image', true);
					let imageAsset: Asset | undefined;

					if (Buffer.isBuffer(image)) {
						imageAsset = await api.ImageAsset.createFromBuffer(image);
					} else if (image) {
						imageAsset = await api.ImageAsset.createFromUrl(image);
					}

					await initiative.updateImage(imageAsset);
					break;
				}
			}
		}
	} catch (error: unknown) {
		let message = 'Unknown error.';

		if (error instanceof ApiError || error instanceof ValidationError) {
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
			error: 'Initiative does not exist.',
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
				error: 'Initiative or person not found',
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

const createModifyBacking =
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
				error: 'Initiative or organisation not found',
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
	createModifyBacking(false),
);
initiativeRouter.delete(
	'/initiative/:initiativeId/organisation/:organisationId',
	requireAdmin(),
	createModifyBacking(true),
);
