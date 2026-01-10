/**
 * Login form component
 * Alpine.js component for authentication
 */

import { login } from '@services/apiService';
import { handleError } from '@services/errorHandlerService';
import { toggleAppView } from '@/main';
import Alpine from 'alpinejs';

export function loginFormComponent() {
  return {
    password: '',
    error: '',
    isLoading: false,

    async handleSubmit() {
      this.error = '';
      this.isLoading = true;

      try {
        const response = await login(this.password);

        // Update auth store
        const authStore = Alpine.store('auth') as {
          setAuthenticated?: (token: string, expiresAt: number) => void;
        };
        if (authStore?.setAuthenticated) {
          authStore.setAuthenticated(response.token, response.expiresAt);
        }

        // Toggle to main app view without page reload
        toggleAppView();
        this.isLoading = false;
      } catch (error) {
        // Handle error - don't show to user via store since we have local error state
        handleError(
          error,
          {
            component: 'loginForm',
            action: 'handleSubmit',
          },
          false
        );

        // Set local error message for display in form
        this.error = error instanceof Error ? error.message : 'Login failed. Please try again.';
        this.isLoading = false;
      }
    },
  };
}
