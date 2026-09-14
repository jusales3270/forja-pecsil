import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PwaControls } from './components/PwaControls';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { TiposServicoPage } from './pages/TiposServicoPage';
import { MotivosParadaPage } from './pages/MotivosParadaPage';
import { ToleranciasPage } from './pages/ToleranciasPage';
import { ArtigosListPage } from './pages/Artigos/ArtigosListPage';
import { ArtigoEditPage } from './pages/Artigos/ArtigoEditPage';
import { OSListPage } from './pages/OS/OSListPage';
import { OSDetailPage } from './pages/OS/OSDetailPage';
import { SelecionarEstacaoPage } from './pages/Totem/SelecionarEstacaoPage';
import { TotemEstacaoPage } from './pages/Totem/TotemEstacaoPage';
import LotesFantasmasPage from './pages/LotesFantasmasPage';
import ConferenciaTurnoPage from './pages/ConferenciaTurnoPage';
import InspecaoPage from './pages/InspecaoPage';
import DashboardPage from './pages/DashboardPage';
import PessoasPage from './pages/PessoasPage';
import { useAuth } from './lib/auth-store';
import { ToastContainer } from './components/Toast';
import { RoleRoute } from './components/RoleRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { rotaInicialPorPapel, type Papel } from './lib/permissions';


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuth((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuth((s) => s.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function HomeRedirect() {
  const pessoa = useAuth((s) => s.pessoa);
  const papel = pessoa?.papel as Papel | undefined;
  const rota = rotaInicialPorPapel(papel);
  if (rota !== '/') return <Navigate to={rota} replace />;
  return <HomePage />;
}

export function App() {

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <PwaControls />
        <ErrorBoundary fallbackTitle="Falha na aplicação" fallbackMessage="Ocorreu um erro ao renderizar esta página. Clique abaixo para voltar." voltarUrl="/">
          <Routes>
            <Route

            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomeRedirect />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tipos-servico"
            element={
              <RoleRoute requireCapability="cadastros_tipos_servico">
                <TiposServicoPage />
              </RoleRoute>
            }
          />
          <Route
            path="/pessoas"
            element={
              <RoleRoute requireCapability="cadastros_pessoas">
                <PessoasPage />
              </RoleRoute>
            }
          />
          <Route
            path="/motivos-parada"
            element={
              <RoleRoute requireCapability="cadastros_motivos_parada">
                <MotivosParadaPage />
              </RoleRoute>
            }
          />
          <Route
            path="/tolerancias"
            element={
              <RoleRoute requireCapability="cadastros_tolerancias">
                <ToleranciasPage />
              </RoleRoute>
            }
          />
          <Route
            path="/artigos"
            element={
              <RoleRoute requireCapability="cadastros_artigos">
                <ArtigosListPage />
              </RoleRoute>
            }
          />
          <Route
            path="/artigos/:id"
            element={
              <RoleRoute requireCapability="cadastros_artigos">
                <ArtigoEditPage />
              </RoleRoute>
            }
          />
          <Route
            path="/os"
            element={
              <RoleRoute requireCapability="os_listar">
                <OSListPage />
              </RoleRoute>
            }
          />
          <Route
            path="/os/:id"
            element={
              <RoleRoute requireCapability="os_listar">
                <OSDetailPage />
              </RoleRoute>
            }
          />
          <Route
            path="/totem"
            element={
              <RoleRoute requireCapability="totem_acessar">
                <SelecionarEstacaoPage />
              </RoleRoute>
            }
          />
          <Route
            path="/totem/:etapaId"
            element={
              <RoleRoute requireCapability="totem_acessar">
                <TotemEstacaoPage />
              </RoleRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RoleRoute requireCapability="dashboard_chefe">
                <DashboardPage />
              </RoleRoute>
            }
          />
          <Route
            path="/inspecao/:id"
            element={
              <RoleRoute requireCapability="inspecao_realizar">
                <InspecaoPage />
              </RoleRoute>
            }
          />
          <Route
            path="/fim-de-turno"
            element={
              <RoleRoute requireCapability="totem_acessar">
                <ConferenciaTurnoPage />
              </RoleRoute>
            }
          />
          <Route
            path="/lotes-fantasmas"
            element={
              <RoleRoute requireCapability="fantasmas_ver">
                <LotesFantasmasPage />
              </RoleRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </ErrorBoundary>
      </BrowserRouter>
      <ToastContainer />
    </QueryClientProvider>

  );
}
