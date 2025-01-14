/*!
Copyright (C)Luca Schnellmann, 2025

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

import type {RequestHandler} from 'express';

export function setHeaders(headers: Record<string, string>): RequestHandler {
	return (_request, response, next) => {
		for (const [key, value] of Object.entries(headers)) {
			response.setHeader(key, value);
		}

		next();
	};
}
