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

import {type Buffer} from 'node:buffer';
import {scrypt as scryptCallback} from 'node:crypto';

export async function scrypt(
	password: string | Buffer,
	salt: string | Buffer,
	keylen: number,
	options?: {
		cost?: number;
		blockSize?: number;
		parallelization?: number;
		maxmem?: number;
	},
): Promise<Buffer> {
	return new Promise<Buffer>((resolve, reject) => {
		scryptCallback(password, salt, keylen, options ?? {}, (error, value) => {
			if (error) {
				reject(error);
			} else {
				resolve(value);
			}
		});
	});
}
