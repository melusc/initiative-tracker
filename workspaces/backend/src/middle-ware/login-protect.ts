import type {LoginInfo} from '@lusc/initiatives-tracker-util/types.js';
import type {Database} from 'better-sqlite3';
import type {RequestHandler} from 'express';
import {z} from 'zod';

export function loginProtect(
	allowedPaths: Set<string> | string[],
	database: Database,
): RequestHandler {
	return (request, response, next) => {
		allowedPaths = new Set(allowedPaths);

		const segments = request.path.split('/');
		// '/path/...'.split is ['', 'path', ...]
		const firstSegment = segments[1];

		if (allowedPaths.has(firstSegment!)) {
			next();
			return;
		}

		const cookies = z
			.object({
				session: z.string(),
			})
			.safeParse(request.cookies);

		if (cookies.success) {
			const sessionCookie = cookies.data.session;

			const session = database
				.prepare<
					{sessionId: string},
					{userId: string; expires: number}
				>('SELECT userId, expires FROM sessions WHERE sessionId = :sessionId')
				.get({
					sessionId: sessionCookie,
				});

			if (session && session.expires > Date.now()) {
				const delta = session.expires - Date.now();

				if (delta < 1.5 * 24 * 60 * 60 * 1000) {
					const expires = new Date();
					expires.setDate(expires.getDate() + 2);

					database
						.prepare<{
							sessionId: string;
							expires: number;
						}>(
							'UPDATE sessions SET expires = :expires WHERE sessionId = :sessionId',
						)
						.run({
							sessionId: sessionCookie,
							expires: expires.getTime(),
						});
				}

				const user = database
					.prepare<
						{userId: string},
						{username: string; isAdmin: 0 | 1}
					>('SELECT username, isAdmin FROM logins WHERE userId = :userId')
					.get({userId: session.userId})!;

				Object.defineProperty(response.locals, 'login', {
					value: {
						name: user.username,
						id: session.userId,
						isAdmin: user.isAdmin === 1,
					} satisfies LoginInfo,
					writable: false,
					configurable: false,
				});

				next();
				return;
			}
		}

		const searchParameters = new URLSearchParams({
			redirect: request.url,
		});
		response.clearCookie('session', {
			httpOnly: true,
		});
		response.redirect(302, '/login?' + searchParameters.toString());
	};
}
