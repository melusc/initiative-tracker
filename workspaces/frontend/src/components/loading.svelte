<!--
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
-->

<div class="loading">Loading</div>

<style>
	.loading {
		font-size: 30px;
		text-align: start;
	}

	.loading::after {
		content: '';
		animation: loading 2s infinite linear alternate;
	}

	@keyframes loading {
		0% {
			content: '';
		}
		33% {
			content: '.';
		}
		66% {
			content: '..';
		}

		100% {
			content: '...';
		}
	}
</style>
