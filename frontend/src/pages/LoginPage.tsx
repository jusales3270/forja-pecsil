import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-store';

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuth((s) => s.login);

  const [codigo, setCodigo] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const codigoRef = useRef<HTMLInputElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);

  // Foco automático no código quando a tela carrega
  useEffect(() => {
    codigoRef.current?.focus();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!codigo.trim()) {
      setError('Informe o código pessoal');
      codigoRef.current?.focus();
      return;
    }

    if (!pin) {
      setError('Informe a senha');
      pinRef.current?.focus();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login(codigo.trim(), pin);
      navigate('/');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Falha ao entrar';
      setError(msg);
      setPin('');
      setTimeout(() => pinRef.current?.focus(), 0);
    } finally {
      setLoading(false);
    }
  };

  // Permite Tab/Enter intuitivos: Enter no campo código pula pro PIN
  const handleCodigoKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      pinRef.current?.focus();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 p-6">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-extrabold text-forja-500 tracking-tight">
            FORJA
          </h1>
          <p className="text-neutral-400 mt-2 text-sm">
            Controle de Produção · Pecsil
          </p>
        </div>

        {/* Card de login */}
        <form
          onSubmit={handleSubmit}
          className="card space-y-5"
          autoComplete="off"
        >
          <div>
            <label htmlFor="codigo" className="label">
              Código pessoal
            </label>
            {/* Aceita número (0020) e nome de estação (fundicao). Antes só
                dígitos, o que barrava as contas de estação. O teclado do tótem
                continua abrindo numérico, que é o caso mais comum. */}
            <input
              ref={codigoRef}
              id="codigo"
              type="text"
              inputMode="numeric"
              maxLength={40}
              value={codigo}
              onChange={(e) => {
                setError(null);
                setCodigo(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase());
              }}
              onKeyDown={handleCodigoKeyDown}
              disabled={loading}
              className="input-lg tracking-widest text-center font-mono"
              placeholder="0000"
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="pin" className="label">
              Senha
            </label>
            <input
              ref={pinRef}
              id="pin"
              type="password"
              value={pin}
              onChange={(e) => {
                setError(null);
                setPin(e.target.value);
              }}
              disabled={loading}
              className="input-lg tracking-widest text-center font-mono"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            disabled={loading || !codigo || !pin}
            className="btn-primary w-full py-3 text-base"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <p className="text-xs text-neutral-500 text-center pt-2">
            Use Tab para navegar e Enter para entrar
          </p>
        </form>

        {/* Versão */}
        <p className="text-center text-neutral-600 text-xs mt-8">
          v0.1 · Sprint 1.1
        </p>
      </div>
    </div>
  );
}
