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
	import type {PersonJson} from '@lusc/initiative-tracker-api';

	import DeleteButton from '../../components/delete-button.svelte';
	import Initiative from '../../components/initiative.svelte';
	import Loading from '../../components/loading.svelte';
	import PageTitle from '../../components/page-title.svelte';
	import EditableTitle from '../../components/person/editable-title.svelte';
	import {getState} from '../../state.ts';

	let person = $state(getState<PersonJson>());
</script>

<PageTitle title={person?.name} />

<div class="person" data-person={person?.id}>
	{#if person}
		<EditableTitle bind:subject={person} patchApi="/api/person/{person.id}" />

		{#if person?.signatures.length > 0}
			<h1>Signed Initiatives</h1>
			<div class="signed-initiatives">
				{#each person.signatures as initiative (initiative.id)}
					<Initiative {initiative} allowEdit={false} standalone={false} />
				{/each}
			</div>
		{/if}

		<DeleteButton
			api="/api/person/{person.id}"
			name={person.name}
			nonAdminAllowed
		/>
	{:else}
		<Loading />
	{/if}
</div>

<style>
	.signed-initiatives {
		display: flex;
		flex-wrap: wrap;
		gap: 1em;

		margin-bottom: 2em;
	}
</style>
