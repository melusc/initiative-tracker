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

<script lang="ts">
	import {colorHash} from '@lusc/initiative-tracker-util/color-hash.js';

	const {name, iconKey}: {name: string; iconKey: string} = $props();
</script>

<div class="user-icon" title={name}>
	<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 128 128">
		<circle cx="64" cy="64" r="64" fill="currentColor" />
		<circle cx="64" cy="64" r="60" fill={colorHash(iconKey)} />
		<text
			x="50%"
			y="50%"
			fill="currentColor"
			dominant-baseline="central"
			text-anchor="middle">{name.toUpperCase()[0]}</text
		>
	</svg>
</div>

<style>
	.user-icon {
		height: 3em;
		width: 3em;

		display: grid;
		place-items: center;
		user-select: none;

		color: var(--text-light);
	}

	text {
		font-size: 70px;
		font-family: 'Open Sans', sans-serif;
	}
</style>
