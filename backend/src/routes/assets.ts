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

import {fileURLToPath} from 'node:url';

import express, {Router} from 'express';

import {assetDirectory} from '../uploads.ts';

const router = Router();

router.use(
	express.static(fileURLToPath(assetDirectory), {
		maxAge: '7d',
		immutable: true,
	}),
);

export {router as assetRouter};
