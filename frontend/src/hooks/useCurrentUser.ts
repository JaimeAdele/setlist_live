import { useState, useEffect } from 'react';

interface CurrentUser {
  userId: string;
  role: string;
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res =>  res.ok ? res.json() : null)
      .then(data => setUser(data));
  }, []);

  async function login(email: string, password: string): Promise<boolean> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include'
    });
    if (res.ok) {
      const data = await res.json();
      setUser({ userId: data.userId, role: data.role });
      return true;
    }
    return false;
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
  }

  const isPrivileged = user?.role === 'ADMIN' || user?.role === 'DJ';
  return { user, isPrivileged, login, logout };
}