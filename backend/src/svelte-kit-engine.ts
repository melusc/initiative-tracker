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

import type {Login} from '@lusc/initiative-tracker-api';
import {uneval} from 'devalue';

function pojoReplacer(value: {toJSON?(): unknown}): string | undefined {
	if (typeof value.toJSON === 'function') {
		return uneval(value.toJSON(), pojoReplacer);
	}

	return;
}

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

	const login = options['login'] as Login | undefined;
	const state = options['state'];

	try {
		const content = await readFile(path, 'utf8');
		const injected = content
			.replace('__state__', uneval(state, pojoReplacer))
			.replace('__login__', uneval(login, pojoReplacer));
		callback(null, injected);
	} catch (error: unknown) {
		callback(error);
	}
}
