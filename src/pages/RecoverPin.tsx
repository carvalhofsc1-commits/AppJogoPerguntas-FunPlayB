import { Link } from 'react-router-dom';

// Fluxo de recuperação de PIN temporariamente desativado: a etapa de
// "enviar e-mail" nunca chegou a ser implementada de verdade (o token
// só aparecia no console em modo dev), então o usuário ficava travado
// achando que um e-mail tinha sido enviado. Até o envio real existir,
// mostramos uma mensagem honesta em vez do formulário.
export default function RecoverPin() {
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <img src="/logo.png" alt="FunPlayB" className="auth-logo" />
        <h1 className="auth-title">Recuperar PIN</h1>

        <div className="auth-form">
          <p className="auth-subtitle">
            A recuperação automática de PIN está temporariamente em manutenção.
          </p>
          <p className="auth-subtitle">
            Para redefinir seu PIN, entre em contato com o administrador do aplicativo.
          </p>
        </div>

        <div className="auth-links">
          <Link to="/login" className="auth-link">← Voltar ao login</Link>
        </div>
      </div>
    </div>
  );
}
