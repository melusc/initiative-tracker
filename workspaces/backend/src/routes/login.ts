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

import type {Buffer} from 'node:buffer';
import {randomBytes, timingSafeEqual} from 'node:crypto';

import {RelativeUrl} from '@lusc/util/relative-url';
import type {Request, Response} from 'express';
import z from 'zod';

import {database} from '../database.ts';
import {scrypt} from '../promisified.ts';

export async function loginPost(request: Request, response: Response) {
	const body = z
		.object({
			username: z.string().trim().toLowerCase().min(1),
			password: z.string().min(1),
		})
		.safeParse(request.body);

	if (!body.success) {
		response.render('login', {
			login: undefined,
			state: {
				error: 'missing-values',
			},
		});
		return;
	}

	const databaseResult = database
		.prepare<
			{username: string},
			{userId: string; passwordHash: Buffer; passwordSalt: Buffer}
		>('SELECT userId, passwordHash, passwordSalt from logins where LOWER(username) = :username')
		.get({username: body.data.username});

	if (!databaseResult) {
		response.render('login', {
			login: undefined,
			state: {
				error: 'incorrect-credentials',
			},
		});
		return;
	}

	const {userId, passwordSalt, passwordHash} = databaseResult;
	const requestHash = await scrypt(body.data.password, passwordSalt, 64);

	if (!timingSafeEqual(passwordHash, requestHash)) {
		response.render('login', {
			login: undefined,
			state: {
				error: 'incorrect-credentials',
			},
		});
		return;
	}

	const sessionId = randomBytes(64).toString('hex');

	const expires = new Date();
	expires.setDate(expires.getDate() + 2);
	// Cookie should expire a bit earlier
	// so cookie will never be valid while actual session id is not
	const cookieExpires = new Date(expires.getTime());
	cookieExpires.setMinutes(cookieExpires.getMinutes() - 5);

	database
		.prepare<{
			userId: string;
			sessionId: string;
			expires: number;
		}>(
			'INSERT INTO sessions (userId, sessionId, expires) values (:userId, :sessionId, :expires)',
		)
		.run({
			userId,
			sessionId,
			expires: expires.getTime(),
		});

	response.cookie('session', sessionId, {
		expires: cookieExpires,
		httpOnly: true,
		secure: true,
	});

	if (request.search.has('redirect')) {
		// Avoid redirects to other websites
		const redirectUrl = new RelativeUrl(request.search.get('redirect')!);

		response.redirect(302, redirectUrl.href);
	} else {
		response.redirect(302, '/');
	}
}
