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

// Reminder:
//	Return -1 for a before b
//  Return 1 for b before a
//	Return 0 for equal

function isNullish(value: unknown): value is null | undefined {
	return value === null || value === undefined;
}

export function makeSorter<R extends Record<string, unknown>>(
	keys: Array<{key: keyof R; reverse: boolean}>,
) {
	return <T extends R>(array: T[]): T[] =>
		array.toSorted((a, b) => {
			for (const {key, reverse} of keys) {
				// Always nullish last
				// A before B
				if (!isNullish(a[key]) && isNullish(b[key])) {
					return -1;
				}

				// B before A
				if (isNullish(a[key]) && !isNullish(b[key])) {
					return 1;
				}

				// Go to next comparison
				if (isNullish(a[key]) && isNullish(b[key])) {
					continue;
				}

				const result = (a[key] as string).localeCompare(
					b[key] as string,
					undefined,
					{
						numeric: true,
						caseFirst: 'lower',
						sensitivity: 'base',
					},
				);

				if (result !== 0) {
					return reverse ? -result : result;
				}
			}

			return 0;
		});
}

export const sortInitiatives = makeSorter<{
	deadline: string | null | undefined;
	shortName: string | null | undefined;
	id: string;
}>([
	{key: 'deadline', reverse: true},
	{key: 'shortName', reverse: false},
	{key: 'id', reverse: false},
]);
export const sortPeople = makeSorter<{
	name: string | null | undefined;
	id: string;
}>([
	{key: 'name', reverse: false},
	{key: 'id', reverse: false},
]);
export const sortOrganisations = makeSorter<{
	name: string | null | undefined;
	id: string;
}>([
	{key: 'name', reverse: false},
	{key: 'id', reverse: false},
]);
