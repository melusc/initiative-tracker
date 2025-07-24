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

export function redirectSlugUrl(oldSlug: string, newSlug: string) {
	if (oldSlug === newSlug) {
		return;
	}

	const newUrl = new URL(location.href);
	const pathSegments = newUrl.pathname
		.split('/')
		.map(segment => (segment === oldSlug ? newSlug : segment));
	newUrl.pathname = pathSegments.join('/');
	history.pushState({}, '', newUrl.href);
}

export function createHandleSlugChange(oldData: {slug: string}) {
	return (newData: {slug: string}) => {
		redirectSlugUrl(oldData.slug, newData.slug);
		oldData.slug = newData.slug;
	};
}
