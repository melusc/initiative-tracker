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

import type {Session} from '@lusc/initiative-tracker-api';
import type {Request, RequestHandler, Response} from 'express';

import {api} from '../database.ts';

export function identifyUser(): RequestHandler {
	return (request, response, next) => {
		let session: Session | undefined;

		const cookies = request.cookies as Record<string, unknown>;
		const sessionCookie = cookies['session'];

		if (typeof sessionCookie === 'string') {
			session = api.Session.fromSessionId(sessionCookie);
		}

		if (session?.shouldRenew()) {
			session = session.renew();
			if (session) {
				response.cookie('session', session.id, {
					expires: session.expiryDate,
					httpOnly: true,
					secure: true,
					sameSite: 'lax',
				});
			}
		}

		Object.defineProperty(response.locals, 'login', {
			value: session?.user,
			writable: false,
			configurable: false,
		});

		next();
		return;
	};
}

function loginRedirect(request: Request, response: Response) {
	const searchParameters = new URLSearchParams({
		redirect: request.originalUrl,
	});
	response.clearCookie('session', {
		httpOnly: true,
		secure: true,
	});
	response.redirect(302, '/login?' + searchParameters.toString());
}

export function requireLogin(): RequestHandler {
	return (request, response, next) => {
		if (response.locals.login) {
			next();
			return;
		}

		loginRedirect(request, response);
	};
}

export function requireAdmin(): RequestHandler {
	return (request, response, next) => {
		if (!response.locals.login) {
			loginRedirect(request, response);
			return;
		}

		if (response.locals.login.isAdmin) {
			next();
			return;
		}

		response.status(401);

		if (request.accepts('html')) {
			response.render('401', {
				login: response.locals.login,
				state: undefined,
			});
			return;
		}

		response.json({
			type: 'error',
			error: 'Not an admin',
		});
	};
}
