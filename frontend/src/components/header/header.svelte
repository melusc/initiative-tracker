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
	import {RelativeUrl} from '@lusc/util/relative-url';

	import {getLogin} from '../../state.ts';
	import Icon from '../icons/icon.svelte';
	import UserIcon from '../user-icon.svelte';

	import HeaderMenu from './header-menu.svelte';

	import {browser} from '$app/environment';

	const loginInfo = getLogin();

	let showMenu = $state(false);

	const loginLink = new RelativeUrl('/login');
	const currentLink = new RelativeUrl(browser ? location.href : '/');
	if (currentLink.path === '/login') {
		loginLink.searchParams.set('redirect', '/');
	} else {
		loginLink.searchParams.set('redirect', currentLink.href);
	}

	function toggleMenu(event: MouseEvent | KeyboardEvent): void {
		if (event.type === 'keydown') {
			const keyEvent = event as KeyboardEvent;
			if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
				showMenu = !showMenu;
			}
		} else {
			showMenu = !showMenu;
		}
	}

	function headerMenuClose(): void {
		showMenu = false;
	}
</script>

<header>
	<a href="/" class="header-title">
		<h1>Initiative Tracker</h1>
		<Icon />
	</a>

	<div class="header-nav">
		<a href="/">Initiatives</a>
		<a href="/people">People</a>
		<a href="/organisations">Organisations</a>
	</div>

	{#if loginInfo}
		<div
			class="user-icon-action"
			role="button"
			tabindex="0"
			onclick={toggleMenu}
			onkeydown={toggleMenu}
		>
			<UserIcon name={loginInfo.username} iconKey={loginInfo.id} />
		</div>
	{:else}
		<a href={loginLink.href} class="login">Login</a>
	{/if}
</header>

{#if showMenu}
	<HeaderMenu close={headerMenuClose}>
		{#snippet userIcon()}
			<div class="user-info">
				{#if loginInfo}
					<UserIcon name={loginInfo.username} iconKey={loginInfo.id} />
					<span>{loginInfo.username}</span>
				{/if}
			</div>
		{/snippet}
	</HeaderMenu>
{/if}

<style>
	header {
		width: 100%;
		padding: 1em;

		position: sticky;
		top: 0;

		display: flex;
		flex-direction: row;
		align-items: center;

		gap: 2em;

		background-color: var(--theme-primary);

		user-select: none;
		box-shadow: var(--box-shadow);

		color: var(--text-light);
	}

	.user-icon-action {
		cursor: pointer;
		margin-left: auto;
	}

	h1 {
		margin: 0;
	}

	a {
		font-weight: 600;
	}

	.header-title {
		display: flex;
		align-items: center;
		gap: 1em;
	}

	.header-title > :global(svg) {
		height: 1.5em;
		width: 1.5em;
	}

	.user-info {
		display: flex;
		align-items: center;
		gap: 0.5em;
	}

	.header-nav {
		display: contents;
	}

	.login {
		margin-left: auto;
	}

	@media (width <= 650px) {
		header {
			grid-template-columns: 3fr 1fr;
		}
		.user-icon-action {
			grid-column: 2;
		}
		.header-nav {
			display: none !important;
		}
	}
</style>
