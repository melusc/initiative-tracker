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
import {setTimeout} from 'node:timers/promises';

import {expect} from 'vitest';

import {apiTest} from '../utilities.js';

apiTest('Creating login', async ({api: {Login}}) => {
	const login = await Login.create('login-u', 'login-p', true);

	expect(login.isAdmin).toStrictEqual(true);
	expect(login.username).toStrictEqual('login-u');
});

apiTest('Update login details', async ({api: {Login}}) => {
	const login = await Login.create('login-u', 'login-p', true);
	let loginCopy = Login.fromUserId(login.id)!;

	expect(login.username).toStrictEqual('login-u');
	expect(loginCopy.username).toStrictEqual('login-u');
	expect(login.isAdmin).toStrictEqual(true);
	expect(loginCopy.isAdmin).toStrictEqual(true);

	let ud = login.updatedAt.getTime();

	await setTimeout(2);

	login.updateIsAdmin(false);
	expect(ud).toBeLessThan((ud = login.updatedAt.getTime()));
	await setTimeout(2);

	login.updateUsername('login-u2');
	expect(ud).toBeLessThan((ud = login.updatedAt.getTime()));

	expect(login.isAdmin).toStrictEqual(false);
	expect(login.username).toStrictEqual('login-u2');

	loginCopy = Login.fromUserId(login.id)!;

	expect(loginCopy.isAdmin).toStrictEqual(false);
	expect(loginCopy.username).toStrictEqual('login-u2');
});

apiTest('Login from credentials', async ({api: {Login}}) => {
	const username = randomBytes(4).toString('base64url');
	const password = randomBytes(10).toString('base64url');

	const login = await Login.create(username, password, false);

	const loginFromCredentials = await Login.fromCredentials(username, password);

	expect(loginFromCredentials).toBeDefined();
	expect(loginFromCredentials!.id).toStrictEqual(login.id);

	// Username is case-insensitive
	const loginFromCredentialsLower = await Login.fromCredentials(
		username.toLowerCase(),
		password,
	);
	const loginFromCredentialsUpper = await Login.fromCredentials(
		username.toUpperCase(),
		password,
	);
	expect(loginFromCredentialsLower?.id).toStrictEqual(login.id);
	expect(loginFromCredentialsUpper?.id).toStrictEqual(login.id);

	const loginWrongUsername = await Login.fromCredentials(
		'wrong-username',
		password,
	);
	expect(loginWrongUsername).toBeUndefined();

	const loginWrongPassword = await Login.fromCredentials(
		username,
		'wrong-password',
	);
	expect(loginWrongPassword).toBeUndefined();
});

apiTest('Login from username', async ({api: {Login}}) => {
	const {id} = await Login.create('login-abc', 'login-abc', true);

	const login = Login.fromUsername('login-abc');

	expect(login).toBeDefined();
	expect(login!.id).toStrictEqual(id);
});

apiTest('Verify password', async ({api: {Login}}) => {
	const login = await Login.create('login-xyz', 'password1', false);

	await expect(login.verifyPassword('password1')).resolves.toStrictEqual(true);
	await expect(login.verifyPassword('lorem-ipsum')).resolves.toStrictEqual(
		false,
	);
});

apiTest('Change password', async ({api: {Login}}) => {
	const oldPassword = randomBytes(10).toString('base64url');
	const newPassword = randomBytes(10).toString('base64url');

	const login = await Login.create('login', oldPassword, true);
	const ud = login.updatedAt.getTime();

	await expect(
		Login.fromCredentials('login', oldPassword),
	).resolves.toBeDefined();
	await expect(
		Login.fromCredentials('login', newPassword),
	).resolves.toBeUndefined();
	await expect(login.verifyPassword(oldPassword)).resolves.toStrictEqual(true);
	await expect(login.verifyPassword(newPassword)).resolves.toStrictEqual(false);

	await login.updatePassword(newPassword);
	expect(login.updatedAt.getTime()).toBeGreaterThan(ud);

	await expect(
		Login.fromCredentials('login', oldPassword),
	).resolves.toBeUndefined();
	await expect(
		Login.fromCredentials('login', newPassword),
	).resolves.toBeDefined();
	await expect(login.verifyPassword(oldPassword)).resolves.toStrictEqual(false);
	await expect(login.verifyPassword(newPassword)).resolves.toStrictEqual(true);
});
