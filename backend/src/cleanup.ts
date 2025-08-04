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

/* eslint n/no-process-exit: off */

import process from 'node:process';

type Handler = () => void;

const handlers = new Set<Handler>();

export function cleanupBeforeExit(callback: Handler) {
	handlers.add(callback);
}

process.once('SIGINT', () => {
	let exitCode = 0;

	for (const handler of handlers) {
		try {
			handler();
		} catch (error: unknown) {
			console.error(error);
			exitCode = 1;
		}
	}

	process.exit(exitCode);
});
