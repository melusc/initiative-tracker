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

import assert from 'node:assert/strict';
import test from 'node:test';

import {makeSlug} from './slug.js';

function makeSlugDeterministic(s: string) {
	return makeSlug(s).split('-').slice(0, -1).join('-');
}

const tests = {
	ö: 'o',
	Ä: 'a',
	ß: 'ss',
	ñ: 'n',
	'Alpha Beta': 'alpha-beta',
	'a-  _  -__ -b': 'a-b',
	' a92 38do   ': 'a92-38do',
	'a-b-': 'a-b',
};

await test('makeSlug', () => {
	for (const [input, output] of Object.entries(tests)) {
		assert.equal(makeSlugDeterministic(input), output);
	}
});
