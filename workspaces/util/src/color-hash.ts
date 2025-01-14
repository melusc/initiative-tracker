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

const colors = [
	'#1e71ad',
	'#f6773c',
	'#6dcebd',
	'#786ca4',
	'#f9c641',
	'#654a70',
	'#2e497f',
	'#c6477a',
	'#1a5790',
	'#ea8cb7',
	'#46a5d6',
	'#c6403d',
	'#334763',
	'#19a84c',
	'#4a006c',
	'#efa932',
	'#5b9e42',
	'#9b1fe8',
	'#e05d41',
	'#2d8c54',
	'#ba9ac1',
	'#b63265',
	'#224e9b',
	'#df814c',
	'#f3ab3f',
	'#cb61a8',
] as const;

export function colorHash(s: string): string {
	let hash = 0;

	s = s.trim().toUpperCase();

	for (const c of s) {
		hash += c.codePointAt(0)!;
	}

	return colors[hash % colors.length]!;
}
