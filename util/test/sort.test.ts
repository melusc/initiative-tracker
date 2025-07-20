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

import {expect, test} from 'vitest';

import {makeSorter} from '../src/sort.js';

const sorter = makeSorter<{
	a: string | null | undefined;
	b: string | null | undefined;
}>([
	{key: 'a', reverse: false},
	{key: 'b', reverse: false},
]);

const sorterReverse = makeSorter<{
	a: string | null | undefined;
	b: string | null | undefined;
}>([
	{key: 'a', reverse: true},
	{key: 'b', reverse: true},
]);

test.for([
	[
		{a: 'a', b: 'c'}, // 1
		{a: 'x', b: 'z'}, // 2
	],
	[
		{a: 'x', b: 'z'}, // 2
		{a: 'a', b: 'c'}, // 1
	],
	[
		{a: null, b: 'c'}, // 2
		{a: null, b: 'd'}, // 1
	],
	[
		{a: null, b: 'c'}, // 2
		{a: 'z', b: 'c'}, // 1
	],
	[
		{a: null, b: null}, // 2
		{a: null, b: 'a'}, // 1
	],
	[
		{a: undefined, b: undefined}, // 2
		{a: null, b: 'a'}, // 1
	],
])('Sorting logic', testCase => {
	const sorted = sorter([...testCase]);
	const sortedReverse = sorterReverse([...testCase]);

	expect(sorted).toMatchSnapshot();
	expect(sorted.toReversed()).toStrictEqual(sortedReverse);
});
