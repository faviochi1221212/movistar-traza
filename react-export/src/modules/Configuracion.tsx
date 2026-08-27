import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors } from '../lib/styles';
import { api } from '../lib/api';
import ReglasCard from '../components/configuracion/ReglasCard';
import PoliticasCard from '../components/configuracion/PoliticasCard';
import SupervisorAccessCard from '../components/configuracion/SupervisorAccessCard';

type Regla = { id: string; codigo: string; modulo: string; nombre: string; descripcion: string | null; tipo_valor: string; valor: any; unidad: string | null; activo: boolean };

export default function Configuracion() {
  const navigate = useNavigate();
  const [reglas, setReglas] = useState<Regla[]>([]);

  const cargar = () => api.get<Regla[]>('/api/configuracion/reglas').then(setReglas);
  useEffect(() => { cargar(); }, []);

  return (
    <div>
      <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20 }}>🛡️</span>
        <div style={{ fontSize: 22, fontWeight: 700, color: colors.textStrong }}>Gobierno de agentes</div>
      </div>

      <div style={{ background: colors.blueBg, border: '1px solid #D6E6FB', borderRadius: 9, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ color: colors.blueDark, fontSize: 14, flexShrink: 0 }}>ⓘ</span>
        <span style={{ fontSize: 12.5, color: colors.text, lineHeight: 1.5 }}>
          Las reglas son editables y se pueden guardar. Las políticas son inmutables y requieren autenticación de supervisor para su modificación.
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.85fr) minmax(280px, 1fr)', gap: 16, alignItems: 'start' }}>
        <ReglasCard reglas={reglas} onGuardado={cargar} onVerAuditoria={() => navigate('/auditoria')} />
        <div>
          <PoliticasCard />
          <SupervisorAccessCard />
        </div>
      </div>
    </div>
  );
}
