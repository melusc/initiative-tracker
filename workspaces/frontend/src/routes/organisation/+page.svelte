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
	import type {EnrichedOrganisation} from '@lusc/initiative-tracker-util/types.js';

	import Initiative from '../../components/initiative.svelte';
	import Loading from '../../components/loading.svelte';
	import Organisation from '../../components/organisation.svelte';
	import PageTitle from '../../components/page-title.svelte';
	import {getState} from '../../state.ts';

	let organisation = $state(getState<EnrichedOrganisation>());
</script>

<PageTitle title={organisation?.name} />

<div class="organisation">
	{#if organisation}
		<h1 class="name">{organisation.name}</h1>
		<Organisation bind:organisation allowEdit standalone />

		{#if organisation.signatures.length > 0}
			<h1 class="initiatives-title">Initiatives</h1>
			<div class="initiatives">
				{#each organisation.signatures as initiative (initiative.id)}
					<Initiative {initiative} allowEdit={false} standalone={false} />
				{/each}
			</div>
		{/if}
	{:else}
		<Loading />
	{/if}
</div>

<style>
	.organisation {
		width: 100%;
	}

	.initiatives {
		display: flex;
		flex-wrap: wrap;
		gap: 2em;
	}

	.name {
		margin-top: 0;
	}
</style>
