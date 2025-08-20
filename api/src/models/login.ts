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
	createdAt: number;
	updatedAt: number;
};

export type LoginJson = {
	id: string;
	username: string;
	isAdmin: boolean;
	createdAt: number;
	updatedAt: number;
};

const privateConstructorKey = Symbol();

export class Login extends InjectableApi {
	private static _HASH_ROUNDS = 10;

	private _username: string;
	private _isAdmin: boolean;
	private _passwordHash: string;
	private _updatedAt: number;
	private _createdAt: number;

	constructor(
		readonly id: string,
		username: string,
		isAdmin: boolean,
		passwordHash: string,
		createdAt: number,
		updatedAt: number,
		contructorKey: symbol,
	) {
		if (contructorKey !== privateConstructorKey) {
			throw new ApiError('Login.constructor is private.');
		}

		super();

		this._username = username;
		this._isAdmin = isAdmin;
		this._passwordHash = passwordHash;
		this._updatedAt = updatedAt;
		this._createdAt = createdAt;
	}

	get username() {
		return this._username;
	}

	get isAdmin() {
		return this._isAdmin;
	}

	get updatedAt() {
		return new Date(this._updatedAt);
	}

	get createdAt() {
		return new Date(this._createdAt);
	}

	private static _fromRow(row: SqlLoginRow): Login;
	private static _fromRow(row: SqlLoginRow | undefined): Login | undefined;
	private static _fromRow(row: SqlLoginRow | undefined) {
		if (!row) {
			return;
		}

		return new this.Login(
			row.userId,
			row.username,
			row.isAdmin === 1,
			row.passwordHash,
			row.createdAt,
			row.updatedAt,
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

		return this._fromRow(row);
	}

	static fromUsername(username: string) {
		// Search case-insensitively
		const row = this.database
			.prepare(
				`SELECT * from logins
				WHERE upper(username) = upper(:username)`,
			)
			.get({
				username,
			}) as SqlLoginRow | undefined;

		return this._fromRow(row);
	}

	static async create(username: string, password: string, isAdmin: boolean) {
		const otherLogin = this.Login.fromUsername(username);

		if (otherLogin) {
			throw new ApiError(`User with username "${username}" already exists.`);
		}

		const passwordHash = await bcrypt.hash(password, this._HASH_ROUNDS);

		const id = 'l-' + randomBytes(20).toString('base64url');
		const now = Date.now();

		this.database
			.prepare(
				`INSERT INTO logins
				(userId, username, passwordHash, isAdmin, createdAt, updatedAt)
				VALUES (:id, :username, :passwordHash, :isAdmin, :now, :now)`,
			)
			.run({
				id,
				username,
				passwordHash,
				isAdmin: isAdmin ? 1 : 0,
				now,
			});

		return new this.Login(
			id,
			username,
			isAdmin,
			passwordHash,
			now,
			now,
			privateConstructorKey,
		);
	}

	static async fromCredentials(username: string, password: string) {
		const user = this.fromUsername(username);

		if (!user) {
			return;
		}

		const passwordMatches = await user.verifyPassword(password);
		if (!passwordMatches) {
			return;
		}

		return user;
	}

	toJSON(): LoginJson {
		return {
			id: this.id,
			username: this.username,
			isAdmin: this.isAdmin,
			createdAt: this._createdAt,
			updatedAt: this._updatedAt,
		};
	}

	async verifyPassword(password: string) {
		return bcrypt.compare(password, this._passwordHash);
	}

	async updatePassword(newPassword: string) {
		const hash = await bcrypt.hash(newPassword, this.Login._HASH_ROUNDS);

		const now = Date.now();

		this.database
			.prepare(
				`UPDATE logins
				SET passwordHash = :hash,
					updatedAt = :now
				WHERE userId = :userId`,
			)
			.run({
				userId: this.id,
				hash,
				now,
			});

		this._passwordHash = hash;
		this._updatedAt = now;
	}

	updateUsername(newUsername: string) {
		if (newUsername === this.username) {
			return;
		}

		const now = Date.now();

		this.database
			.prepare(
				`UPDATE logins
				SET
					username = :username,
					updatedAt = :now
				WHERE userId = :userId`,
			)
			.run({
				userId: this.id,
				username: newUsername,
				now,
			});

		this._username = newUsername;
		this._updatedAt = now;
	}

	updateIsAdmin(newIsAdmin: boolean) {
		if (newIsAdmin === this.isAdmin) {
			return;
		}

		const now = Date.now();

		this.database
			.prepare(
				`UPDATE logins
				SET
					isAdmin = :isAdmin,
					updatedAt = :now
				WHERE userId = :userId`,
			)
			.run({
				userId: this.id,
				isAdmin: newIsAdmin ? 1 : 0,
				now,
			});

		this._isAdmin = newIsAdmin;
		this._updatedAt = now;
	}
}
