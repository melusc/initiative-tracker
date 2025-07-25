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
	import type {InitiativeJson} from '@lusc/initiative-tracker-api';

	import {getLogin} from '../../state.ts';
	import Trash from '../icons/trash.svelte';

	const {initiative = $bindable()}: {initiative: InitiativeJson} = $props();

	const login = getLogin();

	function handleKeyboardRemove(id: string): (event: KeyboardEvent) => void {
		return (event: KeyboardEvent) => {
			if (event.key === 'Enter' || event.key === ' ') {
				void removeById(id);
			}
		};
	}

	async function removeById(id: string): Promise<void> {
		const response = await fetch(
			'/api/initiative/' + initiative.id + '/organisation/' + id,
			{method: 'delete'},
		);

		if (response.ok) {
			initiative.organisations = initiative.organisations.filter(
				organisation => organisation.id !== id,
			);
		}
	}

	function handleClickRemove(id: string): () => void {
		return () => {
			void removeById(id);
		};
	}
</script>

{#if initiative.organisations.length > 0}
	{@const {organisations} = initiative}
	<div class="associated-organisations">
		{#each organisations as organisation (organisation.id)}
			<div class="organisation">
				<a
					class="organisation-image-href"
					href="/organisation/{organisation.slug}"
				>
					{#if organisation.image}
						<img
							class="organisation-image"
							src="/assets/{organisation.image}"
							title={organisation.name}
							alt={organisation.name}
						/>
					{:else}
						{organisation.name}
					{/if}
				</a>
				{#if login?.isAdmin}
					<div
						class="trash"
						onclick={handleClickRemove(organisation.id)}
						onkeydown={handleKeyboardRemove(organisation.id)}
						role="button"
						tabindex="0"
					>
						<Trash />
					</div>
				{/if}
			</div>
		{/each}
	</div>
{/if}

<style>
	.associated-organisations {
		margin-top: 1em;

		display: flex;
		flex-wrap: wrap;
		gap: 2em;
		place-items: center;
	}

	.organisation {
		display: grid;
		grid-template-columns: 1fr;
		grid-template-rows: 1fr;
	}

	.organisation-image-href {
		grid-row: 1;
		grid-column: 1;
	}

	.organisation-image {
		max-height: max-content;
		height: 4em;
		max-width: 200px;
		object-fit: contain;
	}

	.trash {
		display: none;

		height: 1.5em;
		width: 1.5em;
		grid-row: 1;
		grid-column: 1;
		align-self: start;
		justify-self: end;
		color: var(--error);
		background: white;
		border-radius: 50%;
		place-items: center;
		padding: 4px;
		border: 1px solid var(--error);
		cursor: pointer;
	}

	.organisation:hover > .trash {
		display: grid;
	}
</style>
