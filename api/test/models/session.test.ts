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

import {expect} from 'vitest';

import {apiTest} from '../utilities.js';

apiTest(
	'Basic usage with multiple sessions',
	async ({api: {Login, Session}}) => {
		const login1 = await Login.create('login1', 'login1', true);
		const login2 = await Login.create('login2', 'login2', true);

		const session1 = Session.create(login1);
		const session2 = Session.create(login2);

		const session1Copy = Session.fromSessionId(session1.id)!;
		const session2Copy = Session.fromSessionId(session2.id)!;

		expect(session1Copy).toBeDefined();
		expect(session2Copy).toBeDefined();

		expect(session1Copy.user.id).toStrictEqual(session1.user.id);
		expect(session2Copy.user.id).toStrictEqual(session2.user.id);

		expect(session1Copy.expiryDate).toStrictEqual(session1.expiryDate);
		expect(session2Copy.expiryDate).toStrictEqual(session2.expiryDate);
	},
);

apiTest('Invalidating session', async ({api: {Login, Session}}) => {
	const login = await Login.create('login', 'login', true);

	const session = Session.create(login);

	session.invalidate();

	expect(Session.fromSessionId(session.id)).toBeUndefined();
});

apiTest(
	'Removing expired sessions',
	async ({api: {Login, Session, database}}) => {
		const login = await Login.create('login', 'login', true);

		const session = Session.create(login);

		database.prepare('UPDATE sessions SET expires = 0').run();

		expect(Session.fromSessionId(session.id)).toBeUndefined();

		Session.removeExpired();
		expect(
			database.prepare('SELECT count(sessionId) as count FROM sessions').get(),
		).toEqual({
			count: 0,
		});
	},
);

apiTest('Renewing session', async ({api: {Login, Session}}) => {
	const login = await Login.create('login', 'login', true);
	const session = Session.create(login);

	expect(session.shouldRenew()).toStrictEqual(false);

	const fakeExpiry = new Date(
		(session.expiryDate.getTime() + Date.now()) / 2 - 1_000_000,
	);
	// @ts-expect-error it is readonly
	session.expiryDate = fakeExpiry;

	expect(session.shouldRenew()).toStrictEqual(true);

	const sessionRenewed = session.renew()!;
	expect(sessionRenewed).toBeDefined();
	expect(sessionRenewed.id).not.toStrictEqual(session.id);
	expect(sessionRenewed.expiryDate.getTime()).toBeGreaterThan(
		session.expiryDate.getTime(),
	);
	expect(Session.fromSessionId(sessionRenewed.id)).toBeDefined();

	// @ts-expect-error it is readonly
	session.expiryDate = new Date(0);

	expect(session.shouldRenew()).toStrictEqual(false);
	expect(session.renew()).toBeUndefined();
});
