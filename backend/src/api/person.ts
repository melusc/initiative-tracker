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

import {ApiError, type Login, type Person} from '@lusc/initiative-tracker-api';
import {typeOf} from '@lusc/initiative-tracker-util/type-of.js';
import type {ApiResponse} from '@lusc/initiative-tracker-util/types.js';
import {Router, type RequestHandler} from 'express';

import {api} from '../database.ts';
import {requireLogin} from '../middleware/login-protect.ts';
import {multerUpload} from '../uploads.ts';
import {makeValidator} from '../validate-body.ts';

const personKeyValidators = {
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
};

const personValidator = makeValidator(personKeyValidators);

export async function createPerson(
	body: Record<string, unknown>,
	owner: Login,
): Promise<ApiResponse<Person>> {
	const result = await personValidator(body, ['name']);
	if (result.type === 'error') {
		return result;
	}

	try {
		const {name} = result.data;
		const person = api.Person.create(name, owner);
		return {type: 'success', data: person};
	} catch (error: unknown) {
		if (error instanceof ApiError) {
			return {
				type: 'error',
				readableError: error.message,
				error: 'duplicate-person',
			};
		}

		return {
			type: 'error',
			readableError: 'Unknown error.',
			error: 'unknown-error',
		};
	}
}

const createPersonEndpoint: RequestHandler = async (request, response) => {
	const result = await createPerson(
		request.body as Record<string, unknown>,
		response.locals.login!,
	);
	if (result.type === 'success') {
		response.status(201).json(result);
		return;
	}

	response.status(400).json(result);
};

const getPerson: RequestHandler<{id: string}> = async (request, response) => {
	const owner = response.locals.login!;
	const person = api.Person.fromId(request.params.id, owner);

	if (!person) {
		response.status(404).json({
			type: 'error',
			readableError: 'Person does not exist.',
			error: 'not-found',
		});
		return;
	}

	await person.resolveSignatures();

	response.status(200).json({
		type: 'success',
		data: person,
	});
};

const patchPerson: RequestHandler<{id: string}> = async (request, response) => {
	const {id} = request.params;
	const owner = response.locals.login!;

	const person = api.Person.fromId(id, owner);

	if (!person) {
		response.status(404).json({
			type: 'error',
			readableError: 'Person does not exist.',
			error: 'not-found',
		});
		return;
	}

	const body = request.body as Record<string, unknown>;

	const validateResult = await personValidator(
		body,
		Object.keys(body) as Array<keyof typeof personKeyValidators>,
	);

	if (validateResult.type === 'error') {
		response.status(400).json(validateResult);
		return;
	}

	if ('name' in validateResult.data) {
		try {
			person.updateName(validateResult.data.name);
		} catch (error: unknown) {
			if (error instanceof ApiError) {
				response.status(409).json({
					type: 'error',
					error: 'duplicate-person',
					readableError: error.message,
				});
			}

			response.status(500).json({
				type: 'error',
				error: 'unknown-error',
				readableError: 'Unknown error.',
			});
		}
	}

	await person.resolveSignatures();

	response.status(200).json({
		type: 'success',
		data: person,
	});
};

const deletePerson: RequestHandler<{id: string}> = (request, response) => {
	const {id} = request.params;
	const owner = response.locals.login!;
	const person = api.Person.fromId(id, owner);

	if (!person) {
		response.status(404).json({
			type: 'error',
			readableError: 'Person does not exist.',
			error: 'not-found',
		});
		return;
	}

	person.rm();

	response.status(200).json({
		type: 'success',
	});
};

const getAllPeople: RequestHandler = (_request, response) => {
	const login = response.locals.login!;
	const people = api.Person.all(login);
	response.status(200).json({
		type: 'success',
		data: people,
	});
};

export const personRouter = Router();

personRouter.get('/people', requireLogin(), getAllPeople);

personRouter.use('/person', requireLogin());
personRouter.post('/person/create', multerUpload.none(), createPersonEndpoint);
personRouter.get('/person/:id', getPerson);
personRouter.delete('/person/:id', deletePerson);
personRouter.patch('/person/:id', multerUpload.none(), patchPerson);
