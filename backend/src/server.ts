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

import process from 'node:process';

import {ApiError} from '@lusc/initiative-tracker-api';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import {apiRouter} from './api/index.js';
import {createInitiative} from './api/initiative.js';
import {createOrganisation} from './api/organisation.js';
import {createPerson} from './api/person.js';
import {cleanupBeforeExit} from './cleanup.js';
import {api} from './database.js';
import env from './env.js';
import {
	requireAdmin,
	identifyUser,
	requireLogin,
} from './middleware/login-protect.js';
import {assetRouter} from './routes/assets.js';
import {loginPost} from './routes/login.js';
import {logout} from './routes/logout.js';
import {svelteKitEngine} from './svelte-kit-engine.js';
import {multerUpload, staticRoot} from './uploads.js';
import {
	validatePasswordUpdate,
	validateString,
	validateUsernameUpdate,
	ValidationError,
} from './validators.js';

const app = express();

app.engine('html', svelteKitEngine);
app.set('view engine', 'html');
app.set('views', staticRoot);
app.set('x-powered-by', false);
app.set('trust proxy', 'loopback');
app.set('query parser', false);

app.use(cookieParser());
app.use(
	helmet({
		contentSecurityPolicy: {
			useDefaults: false,
			directives: {
				'default-src': ["'none'"],
				'script-src': ["'self'", "'unsafe-inline'"],
				'img-src': ["'self'"],
				'connect-src': ["'self'"],
				'style-src-elem': ["'self'", 'https://fonts.googleapis.com'],
				'style-src-attr': ["'unsafe-inline'"],
				'font-src': ['https://fonts.gstatic.com'],
			},
		},
	}),
);
app.use(morgan('dev'));

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

app.use(identifyUser());

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

app.use('/assets', assetRouter);

app.get('/login', (_request, response) => {
	response.render('login', {login: undefined, state: undefined});
});
app.post('/login', multerUpload.none(), loginPost);

app.get('/logout', (request, response) => {
	logout(request, response, '/');
});

app.get('/', async (_, response) => {
	const initiatives = await api.Initiative.all();

	response.render('index', {
		login: response.locals.login,
		state: initiatives,
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
		const body = request.body as Record<string, unknown>;
		const initiative = await createInitiative(request);

		if (initiative.type === 'error') {
			response.status(400).render('create-initiative', {
				login: response.locals.login,
				state: {
					error: initiative.error,
					values: body,
				},
			});
			return;
		}

		response.redirect(303, `/initiative/${initiative.data.slug}`);
	},
);

app.get('/initiative/:slug', async (request, response) => {
	const login = response.locals.login;
	const initiative = await api.Initiative.fromSlug(request.params.slug);
	if (!initiative) {
		response.status(404).render('404', {login, state: undefined});
		return;
	}

	if (login) {
		await initiative.resolveSignaturesOrganisations(login);
	}

	response.status(200).render('initiative', {
		login,
		state: initiative,
	});
});

app.get('/people', requireLogin(), async (_request, response) => {
	const login = response.locals.login!;
	const people = api.Person.all(login);
	for (const person of people) {
		await person.resolveSignatures();
	}

	response.render('people', {
		state: people,
		login: response.locals.login,
	});
});

app.get('/person/create', requireLogin(), (_, response) => {
	response.render('create-person', {
		login: response.locals.login,
		state: {values: {}},
	});
});

app.post(
	'/person/create',
	requireLogin(),
	multerUpload.none(),
	(request, response) => {
		const body = request.body as Record<string, unknown>;

		const person = createPerson(body, response.locals.login!);

		if (person.type === 'error') {
			response.status(400).render('create-person', {
				login: response.locals.login,
				state: {
					error: person.error,
					values: body,
				},
			});
			return;
		}

		response.redirect(303, `/person/${person.data.slug}`);
	},
);

app.get('/person/:slug', requireLogin(), async (request, response) => {
	const slug = request.params['slug']!;
	const login = response.locals.login!;
	const person = api.Person.fromSlug(slug, login);
	if (person) {
		await person.resolveSignatures();

		response.status(200).render('person', {
			login,
			state: person,
		});

		return;
	}

	response.status(404).render('404', {login, state: undefined});
});

app.get('/organisations', async (_request, response) => {
	const organisations = await api.Organisation.all();

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
		const body = request.body as Record<string, unknown>;
		const organisation = await createOrganisation(request);

		if (organisation.type === 'error') {
			response.status(400).render('create-organisation', {
				login: response.locals.login,
				state: {
					error: organisation.error,
					values: body,
				},
			});
			return;
		}

		response.redirect(303, `/organisation/${organisation.data.slug}`);
	},
);

app.get('/organisation/:slug', async (request, response) => {
	const slug = request.params.slug;
	const organisation = await api.Organisation.fromSlug(slug);
	await organisation?.resolveInitiatives();

	const login = response.locals.login;

	if (organisation) {
		response.status(200).render('organisation', {
			login,
			state: organisation,
		});
	} else {
		response.status(404).render('404', {login, state: undefined});
	}
});

app.get('/account', requireLogin(), (_request, response) => {
	response.render('account', {
		login: response.locals.login,
		state: {
			values: {},
		},
	});
});

app.post(
	'/account',
	requireLogin(),
	multerUpload.none(),
	async (request, response, next) => {
		const body = request.body as Record<string, string>;
		const login = response.locals.login!;

		if (body['virtual-form'] === 'username') {
			let username: string;

			try {
				username = validateUsernameUpdate(body['username']);
			} catch (error: unknown) {
				response.status(400).render('account', {
					login,
					state: {
						error: {
							username: (error as ValidationError).message,
						},
					},
				});
				return;
			}

			try {
				login.updateUsername(username);

				response.status(200).render('account', {
					login,
					state: {
						success: {
							username: 'Username changed successfully.',
						},
					},
				});
			} catch (error: unknown) {
				const message =
					error instanceof ApiError ? error.message : 'Something went wrong.';
				response.status(400).render('account', {
					login,
					state: {
						values: {
							username,
						},
						error: {
							username: message,
						},
					},
				});
			}

			return;
		} else if (body['virtual-form'] === 'password') {
			let newPassword: string;
			let currentPassword: string;

			try {
				currentPassword = validateString(
					body['currentPassword'],
					'current password',
				);
				newPassword = validatePasswordUpdate(
					body['newPassword'],
					body['newPasswordRepeat'],
				);
			} catch (error: unknown) {
				response.status(400).render('account', {
					login,
					state: {
						error: {
							password: (error as ValidationError).message,
						},
					},
				});
				return;
			}

			const currentPasswordIsValid =
				await login.verifyPassword(currentPassword);
			if (!currentPasswordIsValid) {
				response.status(400).render('account', {
					login,
					state: {
						error: {
							password: 'Current password is incorrect.',
						},
					},
				});
			}

			await login.updatePassword(newPassword);
			logout(request, response, '/account');
		} else {
			next();
		}
	},
);

app.use((_request, response) => {
	response
		.status(404)
		.render('404', {login: response.locals.login, state: undefined});
});

const server = app.listen(env.port, '127.0.0.1', () => {
	console.log('Listening on http://localhost:%s/', env.port);
	process.send?.('ready');
});

cleanupBeforeExit(() => {
	server.close();
});
