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
	import type {Snippet} from 'svelte';

	const {children}: {children: Snippet} = $props();
</script>

<div class="card">
	{@render children()}
</div>

<style>
	.card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 1em;
		box-shadow: var(--box-shadow);
		border-radius: 1em;
		padding: 2em;
		background: var(--theme-primary);
		color: var(--text-light);
		font-size: 1.3em;
		width: 400px;
		max-width: calc(100vw - 6em);
	}
</style>
