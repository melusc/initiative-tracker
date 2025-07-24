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

import {ApiError} from '@lusc/initiative-tracker-api';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import {apiRouter} from './api/index.ts';
import {createInitiative} from './api/initiative.ts';
import {createOrganisation} from './api/organisation.ts';
import {createPerson} from './api/person.ts';
import {api} from './database.ts';
import env from './env.ts';
import {
	requireAdmin,
	identifyUser,
	requireLogin,
} from './middleware/login-protect.ts';
import {validatePassword, validateUsername} from './routes/account.ts';
import {assetRouter} from './routes/assets.ts';
import {loginPost} from './routes/login.ts';
import {logout} from './routes/logout.ts';
import {svelteKitEngine} from './svelte-kit-engine.ts';
import {multerUpload, staticRoot} from './uploads.ts';

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
			directives: {
				'script-src': ["'self'", "'unsafe-inline'"],
				'style-src': ["'self'", 'https://fonts.googleapis.com'],
				'style-src-attr': ["'unsafe-inline'"],
			},
		},

		// Nginx is configured to set these
		xContentTypeOptions: false,
		strictTransportSecurity: false,
		xFrameOptions: false,
		xXssProtection: false,
		crossOriginOpenerPolicy: false,
		crossOriginResourcePolicy: false,
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
					error: initiative.readableError,
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
	async (request, response) => {
		const body = request.body as Record<string, unknown>;

		const person = await createPerson(body, response.locals.login!);

		if (person.type === 'error') {
			response.status(400).render('create-person', {
				login: response.locals.login,
				state: {
					error: person.readableError,
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
					error: organisation.readableError,
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
	async (request, response) => {
		const body = request.body as Record<string, string>;
		const login = response.locals.login!;

		if ('username' in body) {
			const username = body['username'];
			const usernameValidity = validateUsername(username);

			if (usernameValidity !== true) {
				response.status(400).render('account', {
					login,
					state: {
						error: {
							username: usernameValidity,
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
				login,
				state: {
					error: {
						password: 'Please fill in all inputs.',
					},
				},
			});
			return;
		}

		const newPasswordsValidity = validatePassword(
			newPassword,
			newPasswordRepeat,
		);

		if (newPasswordsValidity !== true) {
			response.status(400).render('account', {
				login,
				state: {
					error: {
						password: newPasswordsValidity,
					},
				},
			});
			return;
		}

		const currentPasswordIsValid = await login.verifyPassword(currentPassword);
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
	},
);

app.use((_request, response) => {
	response
		.status(404)
		.render('404', {login: response.locals.login, state: undefined});
});

app.listen(env.port, '127.0.0.1', () => {
	console.log('Listening on http://localhost:%s/', env.port);
});
