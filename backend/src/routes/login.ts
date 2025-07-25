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

import {RelativeUrl} from '@lusc/util/relative-url';
import type {Request, Response} from 'express';

import {api} from '../database.ts';

export async function loginPost(request: Request, response: Response) {
	const body = request.body as Record<string, unknown>;
	const username = body['username'];
	const password = body['password'];

	if (
		typeof username !== 'string' ||
		!username.trim() ||
		typeof password !== 'string' ||
		!password
	) {
		response.render('login', {
			login: undefined,
			state: {
				error: 'missing-values',
			},
		});
		return;
	}

	const login = await api.Login.fromCredentials(username, password);

	if (!login) {
		response.render('login', {
			login: undefined,
			state: {
				error: 'incorrect-credentials',
			},
		});
		return;
	}

	const session = api.Session.create(login);
	response.cookie('session', session.id, {
		expires: session.expiryDate,
		httpOnly: true,
		secure: true,
	});

	const search = new RelativeUrl(request.originalUrl).searchParams;

	if (search.has('redirect')) {
		// Avoid redirects to other websites
		const redirectUrl = new RelativeUrl(search.get('redirect')!);

		response.redirect(302, redirectUrl.href);
	} else {
		response.redirect(302, '/');
	}
}
