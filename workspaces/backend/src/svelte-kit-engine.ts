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

import {readFile} from 'node:fs/promises';

import type {Locals} from 'express';

export async function svelteKitEngine(
	path: string,
	options_: unknown,
	callback: (error: unknown, rendered?: string) => void,
): Promise<void> {
	const options = options_ as Record<string, unknown>;

	if (!('login' in options)) {
		callback(new Error('.login not passed to options'));
		return;
	}

	if (!('state' in options)) {
		callback(new Error('.state not passed to options'));
		return;
	}

	const login = options['login'] as Locals['login'] | undefined;
	const state = options['state'];

	try {
		// eslint-disable-next-line security/detect-non-literal-fs-filename
		const content = await readFile(path, 'utf8');
		const injected = content
			.replace('__state__', JSON.stringify(state))
			.replace('__login__', JSON.stringify(login));
		callback(null, injected);
	} catch (error: unknown) {
		callback(error);
	}
}
