<!--
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
-->

<script lang="ts">
	import {getLogin} from '../state.ts';

	import TrashIcon from './icons/trash.svelte';

	const {
		api,
		name,
		nonAdminAllowed = false,
	}: {api: string; name: string; nonAdminAllowed?: boolean} = $props();

	const login = getLogin();

	let confirmed = $state(false);
	async function deleteOrganisation(): Promise<void> {
		if (confirmed) {
			const body = await fetch(api, {method: 'delete'});
			await body.text();
			location.href = '/';
		} else {
			confirmed = true;
		}
	}
</script>

{#if nonAdminAllowed || login?.isAdmin}
	<button class="delete inline-svg button-reset" onclick={deleteOrganisation}>
		{#if confirmed}
			Press again to confirm
		{:else}
			Delete "{name}"
		{/if}
		<TrashIcon />
	</button>
{/if}

<style>
	.inline-svg {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 5px;
	}

	.inline-svg > :global(svg) {
		height: 1em;
		width: 1em;
	}

	.button-reset {
		background: none;
		font: inherit;
		border: none;
		cursor: pointer;
		padding-left: 0;
	}

	.delete {
		color: var(--text-light);
		background: var(--error);
		box-shadow: var(--box-shadow);
		border-radius: 5px;
		padding: 0.3em 0.6em;
		margin-top: 1em;

		transition: 100ms ease-in-out scale;
	}

	.delete:active {
		scale: 0.97;
	}
</style>
