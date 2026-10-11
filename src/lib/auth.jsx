import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';
const Context = createContext(null);
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null),
    [loading, setLoading] = useState(true),
    [expired, setExpired] = useState(false),
    [error, setError] = useState(null);
  async function refresh() {
    try {
      const data = await api('/me');
      setSession(data);
      setError(null);
      return data;
    } catch (e) {
      setSession(null);
      if (e.status !== 401) setError(e);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
    const handler = () => {
      setSession(null);
      setExpired(true);
    };
    window.addEventListener('session-expired', handler);
    return () => window.removeEventListener('session-expired', handler);
  }, []);
  async function login(values) {
    const data = await api('/login', { method: 'POST', body: values });
    setSession(data);
    setExpired(false);
    setError(null);
  }
  async function logout() {
    await api('/logout', { method: 'POST' });
    setSession(null);
  }
  // A permission may be a pipe-separated list (any of): 'people.view|people.directory'.
  const can = (p) => !p || p.split('|').some((key) => Boolean(session?.permissions.includes(key)));
  const enabled = (m) =>
    !m || Boolean((session?.tenant.settings?.modules || ['work', 'notifications', 'people', 'attendance', 'leave', 'payroll', 'recruitment', 'lifecycle']).includes(m));
  return (
    <Context.Provider
      value={{ session, loading, error, expired, login, logout, refresh, can, enabled }}
    >
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
