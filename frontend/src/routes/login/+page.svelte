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
	import PageTitle from '../../components/page-title.svelte';
	import {getState} from '../../state.ts';

	const state = getState<{error?: string}>();
</script>

<PageTitle title="Login" />

<div class="login-form-center">
	<form method="POST" enctype="multipart/form-data">
		<label>
			Username
			<input type="text" name="username" required />
		</label>
		<label>
			Password
			<input type="password" name="password" minlength="12" required />
		</label>
		{#if state?.error === 'incorrect-credentials'}
			<div class="error">Incorrect credentials. Please try again.</div>
		{:else if state?.error === 'missing-values'}
			<div class="error">Please fill in all fields.</div>
		{/if}
		<input type="submit" value="Submit" />
	</form>
</div>

<style>
	.login-form-center {
		width: 100vw;
		display: grid;
		place-items: center;
		margin-top: 3em;
	}

	form {
		display: flex;
		flex-direction: column;
		width: max-content;
		gap: 1em;
		background: var(--theme-primary);
		color: var(--text-light);
		padding: 2em 3em;
		border-radius: 1em;
		font-size: 1.2em;

		box-shadow: var(--box-shadow);
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	input {
		background: none;
		border: 1px solid currentColor;
		color: inherit;
		border-radius: 2px;
		padding: 0.3em 10px;
		font: inherit;
	}

	.error {
		font-size: 1.2em;
		font-weight: 600;
	}
</style>
