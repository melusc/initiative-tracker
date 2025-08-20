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
	createdAt: number;
};

const privateConstructorKey = Symbol();

export class Session extends InjectableApi {
	// 7 days
	private static _SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
	private _createdAt: number;
	private _expiryDate: number;

	constructor(
		readonly id: string,
		readonly user: Login,
		expiryDate: number,
		createdAt: number,
		constructorKey: symbol,
	) {
		if (constructorKey !== privateConstructorKey) {
			throw new ApiError('Session.constructor is private.');
		}

		super();

		this._expiryDate = expiryDate;
		this._createdAt = createdAt;
	}

	get expiryDate() {
		return new Date(this._expiryDate);
	}

	get createdAt() {
		return new Date(this._createdAt);
	}

	static removeExpired() {
		const iterator = this.database
			.prepare(`SELECT * from sessions`)
			.iterate() as Iterable<SqlSessionRow>;

		for (const sessionRow of iterator) {
			const session = this._fromRow(sessionRow);

			if (session?.isExpired()) {
				session.invalidate();
			}
		}
	}

	static create(user: Login) {
		const now = Date.now();
		const expires = now + this._SESSION_DURATION_MS;
		const sessionId = 's-' + randomBytes(128).toString('base64url');

		this.database
			.prepare(
				`INSERT INTO sessions
				(sessionId, userId, expires, createdAt)
				VALUES (:sessionId, :userId, :expires, :createdAt)`,
			)
			.run({
				sessionId,
				userId: user.id,
				expires,
				createdAt: now,
			} satisfies SqlSessionRow);

		return new this.Session(
			sessionId,
			user,
			expires,
			now,
			privateConstructorKey,
		);
	}

	private static _fromRow(row: SqlSessionRow | undefined): Session | undefined {
		if (!row) {
			return;
		}

		const user = this.Login.fromUserId(row.userId);

		if (!user) {
			return;
		}

		return new this.Session(
			row.sessionId,
			user,
			row.expires,
			row.createdAt,
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

		const session = this._fromRow(row);

		return !session || session.isExpired() ? undefined : session;
	}

	isExpired() {
		return this.expiryDate.getTime() < Date.now();
	}

	invalidate() {
		this.database
			.prepare(
				`DELETE FROM sessions
				WHERE sessionId = :sessionId`,
			)
			.run({
				sessionId: this.id,
			});
	}

	shouldRenew() {
		if (this.isExpired()) {
			return false;
		}

		// Renew when more than 50% expired
		const timeToExpire = this.expiryDate.getTime() - Date.now();
		return (
			timeToExpire > 0 && timeToExpire < this.Session._SESSION_DURATION_MS * 0.5
		);
	}

	renew() {
		if (this.isExpired()) {
			return;
		}

		return this.Session.create(this.user);
	}
}
