import {makeSlug} from '@lusc/initiatives-tracker-util/slug.js';
import {typeOf} from '@lusc/initiatives-tracker-util/type-of.js';
import {Router, type RequestHandler} from 'express';
import type {
	EnrichedPerson,
	Initiative,
	Person,
	ApiResponse,
} from '@lusc/initiatives-tracker-util/types.js';
import {
	sortInitiatives,
	sortPeople,
} from '@lusc/initiatives-tracker-util/sort.js';

import {database} from '../db.ts';
import {makeValidator} from '../validate-body.ts';
import {transformInitiativeUrls} from '../paths.ts';

function enrichPerson(person: Person): EnrichedPerson {
	const initiatives = database
		.prepare<{personId: string}, Initiative>(
			`SELECT initiatives.* FROM initiatives
			INNER JOIN signatures on signatures.initiativeId = initiatives.id
			WHERE signatures.personId = :personId`,
		)
		.all({personId: person.id});

	return {
		...person,
		initiatives: sortInitiatives(initiatives).map(initiative =>
			transformInitiativeUrls(initiative),
		),
	};
}

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
	owner: string,
): Promise<ApiResponse<EnrichedPerson>> {
	const result = await personValidator(body, ['name']);

	if (result.type === 'error') {
		return result;
	}

	const {name} = result.data;

	const sameName = database
		.prepare<
			{name: string; owner: string},
			Person
		>('SELECT id, name, owner FROM people WHERE name = :name AND owner = :owner')
		.get({name, owner});
	if (sameName) {
		return {
			type: 'error',
			error: 'duplicate-person',
			readableError: 'Person with that name already exists.',
		};
	}

	const id = makeSlug(name);
	try {
		database
			.prepare<Person>(
				'INSERT INTO people (id, name, owner) values (:id, :name, :owner)',
			)
			.run({
				id,
				name,
				owner,
			});
	} catch {
		return {
			type: 'error',
			readableError: 'Person with that name already exists',
			error: 'person-already-exists',
		};
	}

	return {
		type: 'success',
		data: enrichPerson({
			id,
			name,
			owner,
		}),
	};
}

export const createPersonEndpoint: RequestHandler = async (
	request,
	response,
) => {
	const result = await createPerson(
		request.body as Record<string, unknown>,
		response.locals.login.id,
	);

	if (result.type === 'error') {
		response
			.status(result.error === 'person-already-exists' ? 409 : 400)
			.json(result);
		return;
	}

	return response.status(201).json(result);
};

export function getPerson(id: string, owner: string): EnrichedPerson | false {
	const person = database
		.prepare<
			{id: string; owner: string},
			Person
		>('SELECT id, name, owner FROM people WHERE id = :id AND owner = :owner')
		.get({
			id,
			owner,
		});

	if (!person) {
		return false;
	}

	return enrichPerson(person);
}

export const getPersonEndpoint: RequestHandler<{id: string}> = (
	request,
	response,
) => {
	const result = getPerson(request.params.id, response.locals.login.id);

	if (!result) {
		return response.status(404).json({
			type: 'error',
			readableError: 'Person does not exist.',
			error: 'not-found',
		});
	}

	return response.status(200).json({
		type: 'success',
		data: result,
	});
};

export const patchPerson: RequestHandler<{id: string}> = async (
	request,
	response,
) => {
	const {id} = request.params;

	const oldRow = database
		.prepare<
			{id: string; owner: string},
			Person
		>('SELECT id, name, owner FROM people WHERE id = :id AND owner = :owner')
		.get({id, owner: response.locals.login.id});

	if (!oldRow) {
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

	if (
		'name' in validateResult.data
		&& validateResult.data.name !== oldRow.name
	) {
		const sameName = database
			.prepare<
				{name: string; owner: string},
				Person
			>('SELECT id, name, owner FROM people WHERE name = :name AND owner = :owner')
			.get({name: validateResult.data.name, owner: response.locals.login.id});
		if (sameName) {
			response.status(400).json({
				type: 'error',
				error: 'duplicate-person',
				readableError: 'Person with that name already exists.',
			});
			return;
		}
	}

	const newData = validateResult.data;

	if (Object.keys(newData).length === 0) {
		response.status(200).json({
			type: 'success',
			data: enrichPerson(oldRow),
		});
		return;
	}

	const query = [];

	for (const key of Object.keys(newData)) {
		query.push(`${key} = :${key}`);
	}

	try {
		database
			.prepare<Person>(
				`UPDATE people SET ${query.join(', ')} WHERE id = :id AND owner = :owner`,
			)
			.run({
				...newData,
				id,
				owner: response.locals.login.id,
			});

		response.status(200).send({
			type: 'success',
			data: enrichPerson({
				...oldRow,
				...newData,
			}),
		});
	} catch {
		response.status(409).json({
			type: 'error',
			error: 'unique-name',
			readableError: 'Person with that name already exists.',
		});
	}
};

export const deletePerson: RequestHandler<{id: string}> = async (
	request,
	response,
) => {
	const {id} = request.params;

	const result = database
		.prepare<{
			id: string;
			owner: string;
		}>('DELETE FROM people WHERE id = :id AND owner = :owner')
		.run({id, owner: response.locals.login.id});

	if (result.changes === 0) {
		response.status(404).json({
			type: 'error',
			readableError: 'Person does not exist.',
			error: 'not-found',
		});
		return;
	}

	response.status(200).json({
		type: 'success',
	});
};

export function getAllPeople(owner: string) {
	const rows = database
		.prepare<
			{
				owner: string;
			},
			Person
		>('SELECT id, name, owner FROM people WHERE owner = :owner')
		.all({
			owner,
		});

	return sortPeople(rows).map(person => enrichPerson(person));
}

export const getAllPeopleEndpoint: RequestHandler = async (
	_request,
	response,
) => {
	response.status(200).json({
		type: 'success',
		data: getAllPeople(response.locals.login.id),
	});
};

// eslint-disable-next-line new-cap
export const personRouter = Router();

personRouter.get('/people', getAllPeopleEndpoint);
personRouter.post('/person/create', createPersonEndpoint);
personRouter.get('/person/:id', getPersonEndpoint);
personRouter.delete('/person/:id', deletePerson);
personRouter.patch('/person/:id', patchPerson);