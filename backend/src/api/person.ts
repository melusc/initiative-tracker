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
import type {
	ApiResponse,
	ApiResponseError,
} from '@lusc/initiative-tracker-util/types.js';
import {Router, type RequestHandler} from 'express';

import {api} from '../database.js';
import {requireLogin} from '../middleware/login-protect.js';
import {multerUpload} from '../uploads.js';
import {FieldRequired, validateName, ValidationError} from '../validators.js';

export function createPerson(
	body: Record<string, unknown>,
	owner: Login,
): ApiResponse<Person> {
	let name: string;
	try {
		name = validateName(body['name'], 'Name', FieldRequired.Required);
	} catch (error: unknown) {
		return {
			type: 'error',
			error: (error as ValidationError).message,
		};
	}

	try {
		const person = api.Person.create(name, owner);
		return {type: 'success', data: person};
	} catch (error: unknown) {
		if (error instanceof ApiError) {
			return {
				type: 'error',
				error: error.message,
			};
		}

		return {
			type: 'error',
			error: 'Unknown error.',
		};
	}
}

const createPersonEndpoint: RequestHandler = (request, response) => {
	const result = createPerson(
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
			error: 'Person does not exist.',
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
	const body = request.body as Record<string, unknown>;

	const person = api.Person.fromId(id, owner);

	if (!person) {
		response.status(404).json({
			type: 'error',
			error: 'Person does not exist.',
		});
		return;
	}

	let name: string | undefined;

	try {
		name = validateName(body['name'], 'Name', FieldRequired.Optional);
	} catch (error: unknown) {
		response.status(400).json({
			type: 'error',
			error: (error as ValidationError).message,
		} satisfies ApiResponseError);
		return;
	}

	if (name) {
		try {
			person.updateName(name);
		} catch (error: unknown) {
			if (error instanceof ApiError) {
				response.status(409).json({
					type: 'error',
					error: error.message,
				});
			} else {
				console.error(error);
				response.status(500).json({
					type: 'error',
					error: 'Unknown error.',
				});
			}

			return;
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
			error: 'Person does not exist.',
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
