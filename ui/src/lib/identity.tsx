// The viewer identity, fetched ONCE from /api/me and shared app-wide (KIT-T145). Every place that
// used to hardcode the maintainer's name — the comment-author default, the status agent, the
// ticket-detail viewer whose unread @mentions are computed — reads `alias` from here instead, so
// the client carries ZERO personal-name literals. Until the fetch resolves the alias is the generic
// role literal `user`, so the UI never renders an empty author.

import { createContext, useContext, type ReactNode } from 'react';
import { getMe } from '../services/api';
import { useAsync } from './useAsync';

const FALLBACK_ALIAS = 'user'; // matches the server resolver's own fallback (scripts/identity.DEFAULT_USER)

interface Identity {
  alias: string;
  loading: boolean;
}

const IdentityContext = createContext<Identity>({ alias: FALLBACK_ALIAS, loading: true });

export function IdentityProvider({ children }: { children: ReactNode }) {
  const { data, loading } = useAsync(getMe, []);
  const alias = data?.alias?.trim() || FALLBACK_ALIAS;
  return <IdentityContext.Provider value={{ alias, loading }}>{children}</IdentityContext.Provider>;
}

export function useIdentity(): Identity {
  return useContext(IdentityContext);
}
