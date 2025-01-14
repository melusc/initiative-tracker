/*!
Copyright (C)Luca Schnellmann, 2025

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
*/

import {writable, type Subscriber, type Unsubscriber} from 'svelte/store';

type SuccessState =
	| {
			type: 'success';
	  }
	| {
			type: 'error';
			error: string;
	  }
	| undefined;

export function createSuccessState(): {
	subscribe: (
		run: Subscriber<SuccessState>,
		invalidate?: () => void,
	) => Unsubscriber;
	setSuccess(): void;
	setError(error: string): void;
} {
	const {subscribe, set} = writable<SuccessState>();

	let timeout: ReturnType<typeof setTimeout> | undefined;

	function schedule(callback: () => void, delay: number): void {
		if (timeout) {
			clearTimeout(timeout);
		}

		timeout = setTimeout(() => {
			timeout = undefined;
			callback();
		}, delay);
	}

	function setValue(value: SuccessState, delay: number): void {
		// Clear immediately
		if (value === undefined) {
			if (timeout) {
				timeout = undefined;
				clearTimeout(timeout);
			}

			set(undefined);

			// If the state is already set, temporarily set it to undefined for 200ms
			// before updating it to the new value. This way it is clear that the
			// state was updated, even if the state remains the same.
		} else if (timeout) {
			set(undefined);

			schedule(() => {
				setValue(value, delay);
			}, 200);

			// Otherwise just set it instantly and clear it after `delay`
		} else {
			set(value);

			schedule(() => {
				set(undefined);
			}, delay);
		}
	}

	return {
		subscribe,
		setSuccess(): void {
			setValue({type: 'success'}, 5000);
		},
		setError(error: string): void {
			setValue(
				{
					type: 'error',
					error,
				},
				10_000,
			);
		},
	};
}
