import axios from 'axios';

const baseURL = import.meta.env?.VITE_API_URL ?? (import.meta.env?.DEV ? 'http://localhost:3001' : '');

export const api = axios.create({
  baseURL: `${baseURL}/api`,
  timeout: 10000,
});

// Interceptor: anexa token automaticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('forja_token');
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: se 401, limpa token
api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Uma resposta atrasada da sessão anterior não deve desconectar a nova conta.
    const currentToken = localStorage.getItem('forja_token');
    const requestAuthorization = err.config?.headers?.Authorization;
    // PIN errado no próprio login também é 401: aí a tela tem de mostrar o erro,
    // não recarregar (antes a mensagem sumia junto com o recarregamento).
    const ehLogin = String(err.config?.url ?? '').endsWith('/auth/login');
    if (err.response?.status === 401 && !ehLogin && (!currentToken || requestAuthorization === `Bearer ${currentToken}`)) {
      localStorage.removeItem('forja_token');
      localStorage.removeItem('forja-auth');
      localStorage.removeItem('forja_pessoa');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);
