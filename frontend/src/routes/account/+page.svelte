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
	import {getLogin, getState} from '../../state.ts';

	const login = getLogin();
	const state = getState<{
		values?: Record<string, string>;
		error?: Record<string, string>;
		success?: Record<string, string>;
	}>();
</script>

<PageTitle title="Account" />

<h1>Account</h1>

<h2>Change username</h2>

<form method="POST" enctype="multipart/form-data">
	<input name="virtual-form" value="username" type="hidden" />

	{#if state?.error?.['username']}
		<div class="error">{state.error['username']}</div>
	{:else if state?.success?.['username']}
		<div class="success">{state.success['username']}</div>
	{/if}
	<label>
		New username
		<input
			type="text"
			name="username"
			value={state?.values?.['username'] ?? login?.username}
			required
			minlength="4"
		/>
	</label>
	<input type="submit" name="submit" value="Save" />
</form>

<h2>Change password</h2>

<form method="POST" enctype="multipart/form-data">
	<input name="virtual-form" value="password" type="hidden" />

	{#if state?.error?.['password']}
		<div class="error">{state.error['password']}</div>
	{:else if state?.success?.['password']}
		<div class="success">{state.success['password']}</div>
	{/if}

	<div>
		New password must match the following criteria:

		<ul>
			<li>Contains a special character</li>
			<li>Contains a number</li>
			<li>Contains a lowercase letter</li>
			<li>Contains an uppercase letter</li>
			<li>Is at least 10 characters long</li>
		</ul>
	</div>

	<label>
		Current password
		<input type="password" name="currentPassword" required />
	</label>

	<label>
		New password
		<input
			type="password"
			name="newPassword"
			required
			minlength="10"
			pattern="(?=.*\d)(?=.*[A-Z])(?=.*[a-z])(?=.*[^\da-zA-Z]).+"
		/>
	</label>
	<label>
		Repeat new password
		<input
			type="password"
			name="newPasswordRepeat"
			required
			minlength="10"
			pattern="(?=.*\d)(?=.*[A-Z])(?=.*[a-z])(?=.*[^\da-zA-Z]).+"
		/>
	</label>

	<input type="submit" name="submit" value="Save" />
</form>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 1em;
		width: max-content;
		margin-bottom: 3em;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	input {
		padding: 0.3em 0.6em;
		font: inherit;
		font-size: inherit;
		font-size: 0.8em;
		background: none;
		border: 1px solid var(--theme-primary);
		border-radius: 5px;
	}

	input[type='submit'] {
		cursor: pointer;
	}

	input[type='submit']:active {
		scale: 0.9;
	}

	.success {
		color: var(--success);
	}

	.error {
		color: var(--error);
	}
</style>
