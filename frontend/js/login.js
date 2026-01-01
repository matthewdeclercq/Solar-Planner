/**
 * Login module
 */

import { LOGIN_URL } from './config.js';
import { loginForm, passwordInput, loginBtn, loginError, loginErrorText } from './dom.js';
import { getAuthHeaders } from './auth.js';
import { parseJsonResponse } from './api.js';
import { TOKEN_STORAGE_KEY, TOKEN_EXPIRY_KEY } from './config.js';

/**
 * Setup login form event listener
 */
export function setupLoginForm() {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = passwordInput.value;
    
    loginBtn.disabled = true;
    loginError.classList.add('hidden');
    
    try {
      const response = await fetch(LOGIN_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ password })
      });
      
      if (!response.ok) {
        try {
          const errorData = await parseJsonResponse(response);
          throw new Error(errorData.error || 'Login failed');
        } catch (error) {
          // If parseJsonResponse failed, use generic error message
          if (error.message.includes('Invalid response') || error.message.includes('Empty response')) {
            throw new Error(`Login failed with status ${response.status}`);
          }
          throw error;
        }
      }
      
      const data = await parseJsonResponse(response);
      
      // Store token and expiry
      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      localStorage.setItem(TOKEN_EXPIRY_KEY, data.expiresAt.toString());
      
      // Reload page to show main app
      window.location.reload();
    } catch (error) {
      loginErrorText.textContent = error.message || 'Login failed. Please try again.';
      loginError.classList.remove('hidden');
      loginBtn.disabled = false;
    }
  });
}

