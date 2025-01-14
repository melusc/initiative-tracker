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
	import {getLogin} from '../state.ts';

	import AddIcon from './icons/add.svelte';

	const {
		text,
		href,
		nonAdminAllowed = false,
	}: {text: string; href: string; nonAdminAllowed?: boolean} = $props();

	const login = getLogin();
</script>

{#if nonAdminAllowed || login?.isAdmin}
	<div class="button">
		<a class="href" {href}>{text} <AddIcon /></a>
	</div>
{/if}

<style>
	.button {
		display: flex;
		flex-direction: row;

		justify-content: flex-end;
		padding-bottom: 2em;
	}

	.href {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 5px;

		cursor: pointer;
		text-decoration: none;
		font-size: 20px;

		padding: 0.3em 0.5em;

		border: 1px solid var(--text-dark);
		border-radius: 4px;
	}

	.href > :global(svg) {
		height: 1em;
		width: 1em;
	}
</style>
