import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Facturacion from './modules/Facturacion';
import CobranzasRecaudo from './modules/CobranzasRecaudo';
import BIRecupero from './modules/BIRecupero';
import Cliente360 from './modules/Cliente360';
import Auditoria from './modules/Auditoria';
import CentroControl from './modules/CentroControl';
import Configuracion from './modules/Configuracion';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/centro" replace />} />
        <Route path="centro" element={<CentroControl />} />
        <Route path="facturacion" element={<Facturacion />} />
        <Route path="cobranzas" element={<CobranzasRecaudo />} />
        <Route path="bi" element={<BIRecupero />} />
        <Route path="cliente360" element={<Cliente360 />} />
        <Route path="auditoria" element={<Auditoria />} />
        <Route path="configuracion" element={<Configuracion />} />
      </Route>
    </Routes>
  );
}
