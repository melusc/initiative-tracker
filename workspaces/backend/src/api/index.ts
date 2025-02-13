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

import {Router} from 'express';

import {initiativeRouter} from './initiative.ts';
import {organisationRouter} from './organisation.ts';
import {personRouter} from './person.ts';
import {userContent} from './user-content.ts';

const router = Router();

router.use(organisationRouter);
router.use(initiativeRouter);
router.use(personRouter);
router.use('/user-content', userContent);

export {router as apiRouter};
