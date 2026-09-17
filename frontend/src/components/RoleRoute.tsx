// ============================================================
// Forja - Roteamento por papel/capacidade
// ============================================================

import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-store';
import {
  temCapacidade,
  rotaInicialPorPapel,
  type Capacidade,
  type Papel,
} from '../lib/permissions';

interface RoleRouteProps {
  children: ReactNode;
  /** Capacidade que o papel precisa ter pra acessar esta rota. */
  requireCapability: Capacidade;
}

/**
 * Wrap de rota protegida por capacidade.
 * - Não autenticado → /login
 * - Autenticado mas sem capacidade → rota inicial do papel (ex: tótem)
 */
export function RoleRoute({ children, requireCapability }: RoleRouteProps) {
  const isAuthenticated = useAuth((s) => s.isAuthenticated);
  const pessoa = useAuth((s) => s.pessoa);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!temCapacidade(pessoa, requireCapability)) {
    return <Navigate to={rotaInicialPorPapel(pessoa)} replace />;
  }

  return <>{children}</>;
}
