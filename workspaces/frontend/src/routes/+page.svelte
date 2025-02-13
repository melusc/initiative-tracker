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
	import type {EnrichedInitiative} from '@lusc/initiative-tracker-util/types.js';

	import CreateButton from '../components/create-button.svelte';
	import Initiative from '../components/initiative.svelte';
	import Loading from '../components/loading.svelte';
	import PageTitle from '../components/page-title.svelte';
	import {getState} from '../state.ts';

	const initiatives = getState<EnrichedInitiative[]>();
</script>

<PageTitle />

<CreateButton text="Add initiative" href="/initiative/create" />

<div class="index">
	{#if initiatives}
		{#each initiatives as initiative (initiative.id)}
			<Initiative {initiative} allowEdit={false} standalone={false} />
		{/each}
	{:else}
		<Loading />
	{/if}
</div>

<style>
	.index {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
		gap: 2em;
	}
</style>
