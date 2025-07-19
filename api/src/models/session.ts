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

import {randomBytes} from 'node:crypto';

import {ApiError} from '../error.js';
import {InjectableApi} from '../injectable-api.js';

import type {Login} from './login.js';

type SqlSessionRow = {
	sessionId: string;
	userId: string;
	expires: number;
};

const privateConstructorKey = Symbol();

export class Session extends InjectableApi {
	// 7 days
	static #SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

	constructor(
		readonly sessionId: string,
		readonly user: Login,
		readonly expiryDate: Date,
		constructorKey: symbol,
	) {
		if (constructorKey !== privateConstructorKey) {
			throw new ApiError('Session.constructor is private.');
		}

		super();
	}

	static create(user: Login) {
		const expires = Date.now() + this.#SESSION_DURATION_MS;

		const sessionId = randomBytes(128).toString('base64url');
		this.database
			.prepare(
				`INSERT INTO sessions
			(sessionId, userId, expires)
			VALUES (:sessionId, :userId, :expires)`,
			)
			.run({
				sessionId,
				userId: user.userId,
				expires,
			} satisfies SqlSessionRow);

		return new this.Session(
			sessionId,
			user,
			new Date(expires),
			privateConstructorKey,
		);
	}

	static fromSessionId(sessionId: string): Session | undefined {
		const row = this.database
			.prepare(
				`SELECT * from sessions
			WHERE sessionId = :sessionId`,
			)
			.get({sessionId}) as SqlSessionRow | undefined;

		if (!row) {
			return;
		}

		const user = this.Login.fromUserId(row.userId);

		if (!user) {
			return;
		}

		const session = new this.Session(
			sessionId,
			user,
			new Date(row.expires),
			privateConstructorKey,
		);

		if (session.isExpired()) {
			return;
		}

		return session;
	}

	isExpired() {
		return this.expiryDate.getTime() < Date.now();
	}

	invalidate() {
		this.database
			.prepare(
				`DELETE FROM logins
			WHERE sessionId = :sessionId`,
			)
			.run({
				sessionId: this.sessionId,
			});
	}

	renew() {
		if (this.isExpired()) {
			return;
		}

		return this.Session.create(this.user);
	}
}
