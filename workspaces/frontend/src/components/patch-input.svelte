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
	import type {ApiResponse} from '@lusc/initiative-tracker-util/types.js';
	import {slide} from 'svelte/transition';

	import {createSuccessState} from '../success-state.ts';

	import SaveIcon from './icons/save.svelte';

	let {
		type,
		name,
		label,
		apiEndpoint,
		value = $bindable(),
		allowEmpty = false,
		transform = (s): string => s,
		initialValue = value,
	}: {
		type: 'text' | 'url' | 'date';
		name: string;
		label: string;
		apiEndpoint: string;
		value: string | null;
		allowEmpty?: boolean;
		transform?: (s: string) => string;
		initialValue?: string | null;
	} = $props();
	let node: HTMLInputElement;

	const successState = createSuccessState();

	async function handleSubmit(event: SubmitEvent): Promise<void> {
		event.preventDefault();

		const transformedValue = transform(node.value);

		if (!allowEmpty && !transformedValue) {
			successState.setError('Input must not be empty.');
			return;
		}

		const requestBody = new FormData();
		requestBody.set(name, String(transformedValue));

		const response = await fetch(apiEndpoint, {
			method: 'PATCH',
			body: requestBody,
		});
		const body = (await response.json()) as ApiResponse<Record<string, string>>;

		if (body.type === 'error') {
			successState.setError(body.readableError);
		} else {
			value = body.data[name]!;
			successState.setSuccess();
		}
	}
</script>

<form onsubmit={handleSubmit}>
	<label for={name}>
		{label}
	</label>
	{#if $successState?.type === 'error'}
		<div in:slide out:slide class="error">{$successState.error}</div>
	{/if}

	<div class="input-wrap">
		<input
			class:error={$successState?.type === 'error'}
			class:success={$successState?.type === 'success'}
			{type}
			{name}
			value={initialValue ?? value}
			bind:this={node}
		/><!--
			--><button
			class:error={$successState?.type === 'error'}
			class:success={$successState?.type === 'success'}
			type="submit"
		>
			<SaveIcon />
		</button>
	</div>
</form>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 0.3em;
		width: 100%;
	}

	button > :global(svg) {
		height: 1em;
		width: 1em;
	}

	.input-wrap {
		display: flex;
		flex-direction: row;
		gap: 0;
		height: max-content;
		border-radius: 0.5em;
	}

	.input-wrap:focus-within {
		outline: #0060df 1px auto;
	}

	button,
	input {
		transition:
			0.4s ease-out border-color,
			0.4s ease-out color;

		padding: 0.3em 0.5em;
		border: 1px solid var(--text-light);
		background: #fff;
		color: var(--text-dark);
		font-size: 0.8em;
	}

	input {
		border-radius: 0.5em 0 0 0.5em;
		border-right: none;
		width: 100%;

		margin-right: 0;
		outline: none;
	}

	button {
		border-left: none;
		border-radius: 0 0.5em 0.5em 0;

		margin-left: 0;
		padding-left: 0;

		cursor: pointer;

		display: flex;
		justify-content: center;
		align-items: center;
	}

	button.error,
	input.error {
		border-color: var(--error);
		color: var(--error);
	}

	button.success,
	input.success {
		border-color: var(--success);
		color: var(--success);
	}

	.error,
	.success {
		transition: none;
	}
</style>
