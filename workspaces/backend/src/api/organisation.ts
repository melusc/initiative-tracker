import {unlink} from 'node:fs/promises';
import type {RequestHandler} from 'express';
import {makeSlug} from '@lusc/initiatives-tracker-util/slug.js';
import {typeOf} from '@lusc/initiatives-tracker-util/type-of.js';
import {isValidUrl, makeValidator} from '../validate-body.ts';
import {fetchImage, imageOutDirectory, transformImageUrl} from '../paths.ts';
import {database} from '../db.ts';
import type {ApiResponse} from './response';

type Organisation = {
	id: string;
	name: string;
	image: string | null;
	homepage: string | null;
};

// TODO: function addSignatures

function transformOrganisationUrls(organisation: Organisation): Organisation {
	return {
		...organisation,
		image:
			organisation.image === null
				? null
				: transformImageUrl(organisation.image),
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

		if (!/^[a-züöäéèëï][a-züöäéèëï\d\- .]+$/i.test(name)) {
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
	async image(imageUrl: unknown): Promise<ApiResponse<null | string>> {
		if (imageUrl === null || imageUrl === 'null') {
			return {
				type: 'success',
				data: null,
			};
		}

		if (typeof imageUrl !== 'string') {
			return {
				type: 'error',
				readableError: `Invalid type for image. Expected string, got ${typeOf(imageUrl)}`,
				error: 'invalid-type',
			};
		}

		if (!isValidUrl(imageUrl)) {
			return {
				type: 'error',
				readableError: 'Image URL is not valid URL.',
				error: 'invalid-url',
			};
		}

		try {
			const localImage = await fetchImage(imageUrl);
			return {
				type: 'success',
				data: localImage,
			};
		} catch {
			return {
				type: 'error',
				readableError:
					'Could not fetch Image. Either invalid URL or not an image.',
				error: 'fetch-error',
			};
		}
	},

	homepage(homepage: unknown): ApiResponse<string | null> {
		if (homepage === null || homepage === 'null') {
			return {
				type: 'success',
				data: null,
			};
		}

		if (typeof homepage !== 'string') {
			return {
				type: 'error',
				readableError: `Invalid type for homepage. Expected string, got ${typeOf(homepage)}`,
				error: 'invalid-type',
			};
		}

		if (!isValidUrl(homepage)) {
			return {
				type: 'error',
				readableError: 'homepage is not valid URL.',
				error: 'invalid-url',
			};
		}

		const homepageUrl = new URL(homepage);
		homepageUrl.hash = '';
		homepageUrl.username = '';
		homepageUrl.password = '';

		return {
			type: 'success',
			data: homepageUrl.href,
		};
	},
};

const organisationValidator = makeValidator(organisationKeyValidators);

export const createOrganisation: RequestHandler = async (request, response) => {
	const body = request.body as Record<string, unknown>;
	const result = await organisationValidator(body, [
		'name',
		'image',
		'homepage',
	]);

	if (result.type === 'error') {
		response.status(400).json(result);
		return;
	}

	const {name, image, homepage} = result.data;

	const id = makeSlug(name);
	const organisation: Organisation = {
		id,
		name,
		image,
		homepage,
	};

	database
		.prepare<Organisation>(
			`
		INSERT INTO organisations (id, name, image, homepage)
		values (:id, :name, :image, :homepage)
	`,
		)
		.run(organisation);

	response.status(201).json({
		type: 'success',
		data: transformOrganisationUrls(organisation),
	});
};

export const getAllOrganisations: RequestHandler = (_request, response) => {
	const rows = database
		.prepare<
			[],
			Organisation
		>('SELECT id, name, image, homepage FROM organisations')
		.all();

	response.status(200).json({
		type: 'success',
		data: rows.map(organisation => transformOrganisationUrls(organisation)),
	});
};

export const getOrganisation: RequestHandler<{id: string}> = (
	request,
	response,
) => {
	const organisation = database
		.prepare<
			{id: string},
			Organisation
		>('SELECT id, name, homepage, image FROM organisations WHERE id = :id')
		.get({
			id: request.params.id,
		});

	if (!organisation) {
		return response.status(404).json({
			type: 'error',
			readableError: 'Organisation does not exist.',
			error: 'not-found',
		});
	}

	return response.status(200).json({
		type: 'success',
		data: transformOrganisationUrls(organisation),
	});
};

export const deleteOrganisation: RequestHandler<{id: string}> = async (
	request,
	response,
) => {
	const {id} = request.params;

	const result = database
		.prepare<{id: string}>('DELETE FROM organisations WHERE id = :id')
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
		.prepare<
			{id: string},
			Organisation
		>('SELECT id, name, image, homepage FROM organisations WHERE id = :id')
		.get({id});

	if (!oldRow) {
		response.status(404).json({
			type: 'error',
			readableError: 'Organisation does not exist.',
			error: 'not-found',
		});
		return;
	}

	const body = request.body as Record<string, unknown>;
	const validateResult = await organisationValidator(
		body,
		Object.keys(body) as Array<keyof typeof organisationKeyValidators>,
	);

	if (validateResult.type === 'error') {
		response.status(400).json(validateResult);
		return;
	}

	const newData = validateResult.data;

	if (Object.keys(newData).length === 0) {
		response.status(200).json({
			type: 'success',
			data: oldRow,
		});
		return;
	}

	const query = [];

	for (const key of Object.keys(newData)) {
		if (key === 'image' && oldRow.image !== null) {
			try {
				// eslint-disable-next-line no-await-in-loop
				await unlink(new URL(oldRow.image, imageOutDirectory));
			} catch {}
		}

		query.push(`${key} = :${key}`);
	}

	database
		.prepare(`UPDATE organisations SET ${query.join(', ')} WHERE id = :id`)
		.run({
			...newData,
			id,
		});

	response.status(200).send({
		type: 'success',
		data: transformOrganisationUrls({
			...oldRow,
			...newData,
		}),
	});
};