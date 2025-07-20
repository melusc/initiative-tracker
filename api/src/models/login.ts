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

import bcrypt from 'bcrypt';

import {ApiError} from '../error.js';
import {InjectableApi} from '../injectable-api.js';

type SqlLoginRow = {
	userId: string;
	username: string;
	isAdmin: 0 | 1;
	passwordHash: string;
};

const privateConstructorKey = Symbol();

export class Login extends InjectableApi {
	static #HASH_ROUNDS = 10;

	private _username: string;
	private _isAdmin: boolean;

	constructor(
		readonly userId: string,
		username: string,
		isAdmin: boolean,
		contructorKey: symbol,
	) {
		if (contructorKey !== privateConstructorKey) {
			throw new ApiError('Login.constructor is private.');
		}

		super();

		this._username = username;
		this._isAdmin = isAdmin;
	}

	get username() {
		return this._username;
	}

	get isAdmin() {
		return this._isAdmin;
	}

	static #fromRow(row: SqlLoginRow): Login;
	static #fromRow(row: SqlLoginRow | undefined): Login | undefined;
	static #fromRow(row: SqlLoginRow | undefined) {
		if (!row) {
			return;
		}

		return new this.Login(
			row.userId,
			row.username,
			row.isAdmin === 1,
			privateConstructorKey,
		);
	}

	static fromUserId(userId: string) {
		const row = this.database
			.prepare(
				`SELECT * from logins
				WHERE userId = :userId`,
			)
			.get({
				userId,
			}) as SqlLoginRow | undefined;

		return this.#fromRow(row);
	}

	static fromUsername(username: string) {
		const row = this.database
			.prepare(
				`SELECT * from logins
				WHERE username = :username`,
			)
			.get({
				username,
			}) as SqlLoginRow | undefined;

		return this.#fromRow(row);
	}

	static async create(username: string, password: string, isAdmin: boolean) {
		const otherLogin = this.fromUsername(username);

		if (otherLogin) {
			throw new ApiError(`User with username "${username}" already exists.`);
		}

		const passwordHash = await bcrypt.hash(password, this.#HASH_ROUNDS);

		const id = randomBytes(40).toString('base64url');

		this.database
			.prepare(
				`INSERT INTO logins
				(userId, username, passwordHash, isAdmin)
				VALUES (:id, :username, :passwordHash, :isAdmin)`,
			)
			.run({
				id,
				username,
				passwordHash,
				isAdmin: isAdmin ? 1 : 0,
			});

		return new this.Login(id, username, isAdmin, privateConstructorKey);
	}

	static async fromCredentials(username: string, password: string) {
		const row = this.database
			.prepare(
				`SELECT * from logins
				WHERE username = :username`,
			)
			.get({
				username,
			}) as SqlLoginRow | undefined;

		if (!row) {
			return;
		}

		const passwordMatches = await bcrypt.compare(password, row.passwordHash);
		if (!passwordMatches) {
			return;
		}

		return this.#fromRow(row);
	}

	async verifyPassword(password: string) {
		const row = this.database
			.prepare(
				`SELECT passwordHash from logins
				WHERE userId = :userId`,
			)
			.get({
				userId: this.userId,
			}) as {passwordHash: string};

		return bcrypt.compare(password, row.passwordHash);
	}

	async updatePassword(newPassword: string) {
		const hash = await bcrypt.hash(newPassword, this.Login.#HASH_ROUNDS);

		this.database
			.prepare(
				`UPDATE logins
				SET passwordHash = :hash
				WHERE userId = :userId`,
			)
			.run({
				userId: this.userId,
				hash,
			});
	}

	updateUsername(newUsername: string) {
		if (newUsername === this.username) {
			return;
		}

		this.database
			.prepare(
				`UPDATE logins
				SET username = :username
				WHERE userId = :userId`,
			)
			.run({
				userId: this.userId,
				username: newUsername,
			});

		this._username = newUsername;
	}

	updateIsAdmin(isAdmin: boolean) {
		if (isAdmin === this.isAdmin) {
			return;
		}

		this.database
			.prepare(
				`UPDATE logins
				SET isAdmin = :isAdmin
				WHERE userId = :userId`,
			)
			.run({
				userId: this.userId,
				isAdmin: isAdmin ? 1 : 0,
			});
	}
}
