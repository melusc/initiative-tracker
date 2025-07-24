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

	import Signature from '../signature.svelte';

	const {initiative = $bindable()}: {initiative: InitiativeJson} = $props();

	async function removeById(id: string): Promise<void> {
		const response = await fetch(
			'/api/initiative/' + initiative.id + '/sign/' + id,
			{method: 'delete'},
		);

		if (response.ok) {
			initiative.signatures =
				initiative.signatures?.filter(person => person.id !== id) ?? null;
		}
	}
</script>

{#if initiative.signatures && initiative.signatures.length > 0}
	{@const people = initiative.signatures}
	<div class="signed-by">
		{#each people as person (person.id)}
			<Signature
				name={person.name}
				id={person.id}
				slug={person.slug}
				onRemove={removeById}
			/>
		{/each}
	</div>
{/if}

<style>
	.signed-by {
		margin-top: 1em;

		display: flex;
		flex-wrap: wrap;
		gap: 2em;
	}
</style>
