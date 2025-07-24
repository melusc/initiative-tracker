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

import type {Request, Response} from 'express';

import {api} from '../database.ts';

export function logout(
	request: Request,
	response: Response,
	redirectPath: string,
) {
	const sessionCookie = request.cookies['session'] as string | undefined;

	if (typeof sessionCookie === 'string') {
		const session = api.Session.fromSessionId(sessionCookie);
		session?.invalidate();
	}

	response
		.clearCookie('session', {
			httpOnly: true,
		})
		.redirect(302, redirectPath);
}
