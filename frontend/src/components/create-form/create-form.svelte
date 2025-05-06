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
	import {getState} from '../../state.ts';
	import Card from '../card.svelte';
	import PageTitle from '../page-title.svelte';
	import StandaloneCenter from '../standalone-center.svelte';

	import type {Input} from './create-form.d.ts';
	import FileInput from './file-input.svelte';

	const {title, inputs}: {title: string; inputs: Input[]} = $props();

	const {
		error,
		values,
	}: {
		error?: string;
		values: Record<string, string>;
	} = getState() ?? {values: {}};
</script>

<PageTitle {title} />

<StandaloneCenter>
	<form method="POST" enctype="multipart/form-data">
		<Card>
			<h1>{title}</h1>
			{#if error}
				<div class="error">{error}</div>
			{/if}

			{#each inputs as input (input.name)}
				<label for={input.name}>
					{input.label}
					{#if input.type === 'file'}
						<FileInput {values} {input} />
					{:else}
						<input
							type={input.type}
							name={input.name}
							required={input.required ?? true}
							minlength={input.minlength}
							value={values[input.name] ?? ''}
						/>
					{/if}
				</label>
			{/each}

			<input class="submit" type="submit" value="Submit" />
		</Card>
	</form>
</StandaloneCenter>

<style>
	form {
		min-width: 450px;
		display: inline;
	}

	@media (width <= 500px) {
		form {
			min-width: auto;
		}
	}

	label {
		display: flex;
		flex-direction: column;
		width: 100%;
	}

	input {
		color: var(--text-dark);
		border-radius: 0.5em;
		padding: 0.5em 0.7em;
		font-size: 0.8em;
		border: none;
	}

	.submit {
		border: 1px solid var(--text-light);
		background: none;
		color: var(--text-light);
		box-shadow: var(--box-shadow);
		border-radius: 5px;
		padding: 0.3em 0.6em;
		margin-top: 1em;
		cursor: pointer;

		transition: 100ms ease-in-out scale;
	}

	.submit:active {
		scale: 0.97;
	}
</style>
