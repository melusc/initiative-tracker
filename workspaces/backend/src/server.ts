/*!
Copyright (C)Luca Schnellmann, 2025

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

import {RelativeUrl} from '@lusc/util/relative-url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import {apiRouter} from './api/index.ts';
import {
	createInitiative,
	getAllInitiatives,
	getInitiative,
} from './api/initiative.ts';
import {
	createOrganisation,
	getAllOrganisations,
	getOrganisation,
} from './api/organisation.ts';
import {createPerson, getAllPeople, getPerson} from './api/person.ts';
import {database} from './database.ts';
import {loginProtect} from './middle-ware/login-protect.ts';
import {requireAdmin} from './middle-ware/require-admin.ts';
import {setHeaders} from './middle-ware/set-headers.ts';
import {changePassword, changeUsername} from './routes/account.ts';
import {loginPost} from './routes/login.ts';
import {logout} from './routes/logout.ts';
import {svelteKitEngine} from './svelte-kit-engine.ts';
import {mergeExpressBodyFile, multerUpload, staticRoot} from './uploads.ts';

const app = express();

app.engine('html', svelteKitEngine);
app.set('view engine', 'html');
app.set('views', staticRoot);

app.use(express.urlencoded({extended: true}));
app.use(cookieParser());
app.use(
	helmet({
		contentSecurityPolicy: {
			directives: {
				'script-src': ["'self'", "'unsafe-inline'"],
			},
		},

		// Nginx already sets the following
		xContentTypeOptions: false,
		strictTransportSecurity: false,
		xFrameOptions: false,
		xXssProtection: false,
	}),
);
app.use(cors());
app.use(morgan('dev'));

app.use(
	setHeaders({
		'permissions-policy': 'interest-cohort=()',
	}),
);

app.use((request, response, next) => {
	const segments = request.path.split('/');
	if (segments.includes('..')) {
		response.status(418).type('txt').send('..');
		return;
	}

	next();
});

app.use((request, response, next) => {
	if (request.path.includes('\\')) {
		response
			.status(404)
			.render('404', {login: response.locals.login, state: undefined});
		return;
	}

	next();
});

app.get('/robots.txt', (_request, response) => {
	response
		.status(200)
		.type('txt')
		.send(
			`User-agent: GPTBot
Disallow: /

User-agent: Google-Extended
Disallow: /`,
		);
});

app.use(loginProtect(['login', 'static'], database));

app.use((request, _response, next) => {
	request.search = new RelativeUrl(request.url).searchParams;
	next();
});

app.use('/api', apiRouter);
app.use(
	'/static',
	express.static(staticRoot, {
		index: false,
		setHeaders(response) {
			response.setHeader('Cache-Control', 'public, max-age=3600, immutable');
		},
	}),
);

app.get('/login', (_request, response) => {
	response.render('login', {login: undefined, state: undefined});
});
app.post('/login', loginPost);

app.get('/logout', (request, response) => {
	logout(request, response, '/');
});

app.get('/', (_, response) => {
	response.render('index', {
		login: response.locals.login,
		state: getAllInitiatives(response.locals.login.id),
	});
});

app.get('/initiative/create', requireAdmin(), (_, response) => {
	response.render('create-initiative', {
		login: response.locals.login,
		state: {values: {}},
	});
});

app.post(
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
	async (request, response) => {
		const body = mergeExpressBodyFile(request, ['pdf', 'image']);

		const initiative = await createInitiative(response.locals.login.id, body);

		if (initiative.type === 'error') {
			response.status(400).render('create-initiative', {
				login: response.locals.login,
				state: {
					error: initiative.readableError,
					values: request.body as Record<string, unknown>,
				},
			});
			return;
		}

		response.redirect(303, `/initiative/${initiative.data.id}`);
	},
);

app.get('/initiative/:id', (request, response) => {
	const initiative = getInitiative(request.params.id, response.locals.login.id);
	if (initiative) {
		response.status(200).render('initiative', {
			login: response.locals.login,
			state: initiative,
		});
	} else {
		response
			.status(404)
			.render('404', {login: response.locals.login, state: undefined});
	}
});

app.get('/people', (_request, response) => {
	const people = getAllPeople(response.locals.login.id);

	response.render('people', {
		state: people,
		login: response.locals.login,
	});
});

app.get('/person/create', (_, response) => {
	response.render('create-person', {
		login: response.locals.login,
		state: {values: {}},
	});
});

app.post('/person/create', multerUpload.none(), async (request, response) => {
	const body = request.body as Record<string, unknown>;

	const person = await createPerson(body, response.locals.login.id);

	if (person.type === 'error') {
		response.status(400).render('create-person', {
			login: response.locals.login,
			state: {
				error: person.readableError,
				values: request.body as Record<string, unknown>,
			},
		});
		return;
	}

	response.redirect(303, `/person/${person.data.id}`);
});

app.get('/person/:id', (request, response) => {
	const person = getPerson(request.params.id, response.locals.login.id);
	if (person) {
		response.status(200).render('person', {
			login: response.locals.login,
			state: person,
		});
	} else {
		response
			.status(404)
			.render('404', {login: response.locals.login, state: undefined});
	}
});

app.get('/organisations', (_request, response) => {
	const organisations = getAllOrganisations();

	response.status(200).render('organisations', {
		login: response.locals.login,
		state: organisations,
	});
});

app.get('/organisation/create', requireAdmin(), (_, response) => {
	response.render('create-organisation', {
		login: response.locals.login,
		state: {values: {}},
	});
});

app.post(
	'/organisation/create',
	requireAdmin(),
	multerUpload.fields([
		{
			name: 'image',
			maxCount: 1,
		},
	]),
	async (request, response) => {
		const body = mergeExpressBodyFile(request, ['image']);

		const organisation = await createOrganisation(request);

		if (organisation.type === 'error') {
			response.status(400).render('create-organisation', {
				login: response.locals.login,
				state: {
					error: organisation.readableError,
					values: body,
				},
			});
			return;
		}

		response.redirect(303, `/organisation/${organisation.data.id}`);
	},
);

app.get('/organisation/:id', (request, response) => {
	const organisation = getOrganisation(request.params.id);
	if (organisation) {
		response.status(200).render('organisation', {
			login: response.locals.login,
			state: organisation,
		});
	} else {
		response
			.status(404)
			.render('404', {login: response.locals.login, state: undefined});
	}
});

app.get('/account', (_request, response) => {
	response.render('account', {
		login: response.locals.login,
		state: {
			values: {},
		},
	});
});

app.post('/account', async (request, response) => {
	const body = request.body as Record<string, string>;
	if ('username' in body) {
		const username = body['username'];
		if (typeof username !== 'string') {
			response.status(400).render('account', {
				login: response.locals.login,
				state: {
					error: {
						username: 'Username was not a string.',
					},
				},
			});
			return;
		}

		try {
			changeUsername(username, response.locals.login.id);
			response.status(200).render('account', {
				login: {
					...response.locals.login,
					name: username.trim(),
				},
				state: {
					success: {
						username: 'Username changed successfully.',
					},
				},
			});
		} catch (error: unknown) {
			const message =
				error instanceof Error ? error.message : 'Something went wrong.';
			response.status(400).render('account', {
				login: response.locals.login,
				state: {
					values: {username},
					error: {
						username: message,
					},
				},
			});
		}

		return;
	}

	const currentPassword = body['currentPassword'];
	const newPassword = body['newPassword'];
	const newPasswordRepeat = body['newPasswordRepeat'];

	if (
		typeof currentPassword !== 'string' ||
		typeof newPassword !== 'string' ||
		typeof newPasswordRepeat !== 'string'
	) {
		response.status(400).render('account', {
			login: response.locals.login,
			state: {
				error: {
					password: 'Please fill in all inputs.',
				},
			},
		});
		return;
	}

	try {
		await changePassword(
			response.locals.login.id,
			currentPassword,
			newPassword,
			newPasswordRepeat,
		);
		logout(request, response, '/account');
	} catch (error: unknown) {
		const message =
			error instanceof Error ? error.message : 'Something went wrong.';
		response.status(400).render('account', {
			login: response.locals.login,
			state: {
				error: {
					password: message,
				},
			},
		});
	}
});

app.use((_request, response) => {
	response
		.status(404)
		.render('404', {login: response.locals.login, state: undefined});
});

app.listen(3129, () => {
	console.log('Listening on http://localhost:3129/');
});
