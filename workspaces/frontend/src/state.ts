/*!
Copyright (C) 2024  Luca Schnellmann

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

import type {LoginInfo} from '@lusc/initiatives-tracker-util/types.js';

declare const state: unknown;

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function getState<T>(): T | undefined {
	// eslint-disable-next-line unicorn/no-typeof-undefined
	return typeof state === 'undefined' ? undefined : (state as T);
}

declare const login: LoginInfo | undefined;

export function getLogin(): LoginInfo | undefined {
	// eslint-disable-next-line unicorn/no-typeof-undefined
	return typeof login === 'undefined' ? undefined : login;
}
