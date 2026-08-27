import { useState } from 'react';
import { colors } from '../../lib/styles';
import { api } from '../../lib/api';

export default function SupervisorAccessCard() {
  const [activo, setActivo] = useState(false);
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [supervisorEmail, setSupervisorEmail] = useState('');

  const iniciarSesion = async () => {
    if (!usuario.trim() || !password.trim() || enviando) return;
    setEnviando(true);
    try {
      // TRAZA no tiene todavia un sistema de roles/autenticacion propio: esto
      // es una reautenticacion conceptual (seccion 28 del prompt), no login
      // real contra credenciales. Lo unico que persiste es la constancia en
      // Auditoria de que alguien reautentico para entrar en modo supervisor.
      await api.post('/api/configuracion/supervisor-acceso', { usuario });
      setSupervisorEmail(usuario);
      setActivo(true);
      setPassword('');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 12, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 15 }}>🛡️</span>
        <div style={{ fontSize: 15, fontWeight: 700, color: colors.textStrong }}>Acceso de supervisor requerido</div>
      </div>

      {activo ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: colors.greenBg, borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: colors.green, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.greenDark }}>Modo supervisor activo</div>
              <div style={{ fontSize: 11, color: colors.text, marginTop: 1 }}>{supervisorEmail}</div>
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: colors.textMuted, lineHeight: 1.5 }}>
            Este acceso quedó registrado en Auditoría. Las políticas corporativas siguen siendo de solo lectura: ningún rol puede modificarlas desde esta pantalla.
          </div>
          <button onClick={() => setActivo(false)} style={{ marginTop: 12, height: 32, padding: '0 14px', borderRadius: 7, border: `1px solid ${colors.border}`, background: '#fff', color: colors.text, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cerrar modo supervisor</button>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.5, marginBottom: 14 }}>
            Solo un supervisor autorizado puede acceder a la administración de políticas corporativas.<br />Inicia sesión para verificar tu identidad.
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={label}>Usuario / correo</label>
            <input value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="supervisor@empresa.com" style={input} />
          </div>
          <div style={{ marginBottom: 14, position: 'relative' }}>
            <label style={label}>Contraseña</label>
            <input
              value={password} onChange={(e) => setPassword(e.target.value)} type={verPassword ? 'text' : 'password'}
              placeholder="Ingresa tu contraseña" style={{ ...input, paddingRight: 60 }}
            />
            <span onClick={() => setVerPassword((v) => !v)} style={{ position: 'absolute', right: 12, top: 30, fontSize: 11, color: colors.blueDark, cursor: 'pointer', fontWeight: 600 }}>
              {verPassword ? 'Ocultar' : 'Mostrar'}
            </span>
          </div>

          <button
            onClick={iniciarSesion}
            disabled={!usuario.trim() || !password.trim() || enviando}
            style={{
              width: '100%', height: 38, borderRadius: 7, border: 'none', fontSize: 13, fontWeight: 600, color: '#fff',
              background: usuario.trim() && password.trim() ? colors.navy : '#CBD5E1',
              cursor: usuario.trim() && password.trim() && !enviando ? 'pointer' : 'default',
            }}
          >
            {enviando ? 'Verificando…' : 'Iniciar sesión como supervisor'}
          </button>

          <div style={{ fontSize: 10.5, color: colors.textFaint, marginTop: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span>🔒</span> El acceso de supervisor queda registrado y auditado.
          </div>
        </>
      )}
    </div>
  );
}

const label: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 5 };
const input: React.CSSProperties = { width: '100%', height: 36, border: `1px solid ${colors.border}`, borderRadius: 7, padding: '0 12px', fontSize: 12.5, outline: 'none', boxSizing: 'border-box' };
