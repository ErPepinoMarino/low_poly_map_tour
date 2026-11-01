import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

// Red de seguridad de la UI: si algo falla en render o en un efecto, en lugar de
// dejar la pantalla en blanco (o solo con el fondo) mostramos el error real.
// Es la primera parada para diagnosticar: el mensaje y la traza quedan visibles.

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

function ErrorFallback({ error }: { error: Error }) {
  const { t } = useTranslation();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        overflow: 'auto',
        padding: 32,
        background: '#2A2D31',
        color: '#F2E6D0',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <h1 style={{ margin: 0, fontSize: 20 }}>{t('error.title')}</h1>
      <p style={{ margin: '8px 0 16px', opacity: 0.75 }}>{t('error.body')}</p>
      <pre
        style={{
          margin: 0,
          padding: 12,
          borderRadius: 8,
          background: 'rgba(0, 0, 0, 0.35)',
          color: '#FFB4A2',
          fontSize: 13,
          whiteSpace: 'pre-wrap',
        }}
      >
        {error.message}
      </pre>
      {error.stack ? (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', opacity: 0.75 }}>stack</summary>
          <pre
            style={{
              margin: '8px 0 0',
              padding: 12,
              borderRadius: 8,
              background: 'rgba(0, 0, 0, 0.35)',
              fontSize: 12,
              whiteSpace: 'pre-wrap',
            }}
          >
            {error.stack}
          </pre>
        </details>
      ) : null}
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          marginTop: 16,
          padding: '8px 14px',
          border: 0,
          borderRadius: 6,
          background: '#E0A23C',
          color: '#1B2A4A',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {t('error.reload')}
      </button>
    </div>
  );
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) return <ErrorFallback error={this.state.error} />;
    return this.props.children;
  }
}
