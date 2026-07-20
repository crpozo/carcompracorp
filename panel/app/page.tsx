'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { signOut, fetchUserAttributes } from 'aws-amplify/auth';
import {
  getLeads,
  getStats,
  getVendedores,
  type Lead,
  type Stats as StatsType,
  type Vendedor,
} from '../lib/api';
import Sidebar, { type View } from '../components/Sidebar';
import Topbar from '../components/Topbar';
import LeadsTable from '../components/LeadsTable';
import Pagination from '../components/Pagination';
import VendedoresTable from '../components/VendedoresTable';
import Reportes from '../components/Reportes';
import Integracion from '../components/Integracion';
import LeadDrawer from '../components/LeadDrawer';
import Providers, { EMAIL_KEY, REMEMBER_KEY } from './providers';

const PAGE_SIZE = 8;

const VIEW_META: Record<View, { crumb: string; title: string }> = {
  leads: { crumb: 'Contactos', title: 'Mis Leads' },
  vendedores: { crumb: 'Contactos', title: 'Vendedores' },
  reportes: { crumb: 'Análisis', title: 'Reportes' },
  integracion: { crumb: 'Configuración', title: 'Integración' },
};

// El wrapper de auth vive aquí (no en el layout) para que /privacidad sea pública.
export default function DashboardPage() {
  return (
    <Providers>
      <Dashboard />
    </Providers>
  );
}

function Dashboard() {
  const [view, setView] = useState<View>('leads');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [stats, setStats] = useState<StatsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [query, setQuery] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Read everything once; filtering / search / pagination happen client-side.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [v, s, l] = await Promise.all([
          getVendedores(),
          getStats(),
          getLeads(),
        ]);
        if (cancelled) return;
        setVendedores(v);
        setStats(s);
        setLeads(l);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Error al cargar el panel.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    fetchUserAttributes()
      .then((a) => {
        if (cancelled) return;
        setEmail(a.email ?? '');
        // "Recordar mi correo": se guarda tras un login exitoso para
        // precargarlo la próxima vez (nunca se guarda la contraseña).
        try {
          if (a.email && window.localStorage.getItem(REMEMBER_KEY) !== '0') {
            window.localStorage.setItem(EMAIL_KEY, a.email);
          }
        } catch {
          /* almacenamiento no disponible: ignorar */
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const nameFor = useCallback(
    (id?: string) =>
      id ? vendedores.find((v) => v.vendedorId === id)?.nombre ?? id : '',
    [vendedores]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (vendorFilter && l.vendedorId !== vendorFilter) return false;
      if (!q) return true;
      return [l.nombre, l.telefono, l.anuncioOrigen, l.mensaje, l.ultimoMensaje, nameFor(l.vendedorId)]
        .some((f) => (f ?? '').toLowerCase().includes(q));
    });
  }, [leads, query, vendorFilter, nameFor]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const paged = filtered.slice(
    (pageClamped - 1) * PAGE_SIZE,
    pageClamped * PAGE_SIZE
  );

  const onQuery = (v: string) => {
    setQuery(v);
    setPage(1);
  };
  const onVendor = (v: string) => {
    setVendorFilter(v);
    setPage(1);
  };
  const switchView = (v: View) => {
    setView(v);
    setPage(1);
  };

  const exportCSV = useCallback(() => {
    const header = [
      'Recibido', 'Nombre', 'Telefono', 'Anuncio', 'Mensaje', 'Vendedor', 'Estado',
    ];
    const rows = filtered.map((l) => [
      l.creadoEn, l.nombre, l.telefono, l.anuncioOrigen ?? '', l.mensaje ?? '',
      nameFor(l.vendedorId), l.estado,
    ]);
    const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads-carcompra.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered, nameFor]);

  return (
    <div className="app">
      <Sidebar view={view} onView={switchView} />
      <div className="main">
        <Topbar
          query={query}
          onQuery={onQuery}
          email={email}
          onSignOut={() => signOut()}
        />
        <div className="content">
          <div className="page-head">
            <div>
              <div className="crumb">{VIEW_META[view].crumb}</div>
              <h1>{VIEW_META[view].title}</h1>
            </div>
            {view !== 'integracion' && (
              <span className="count-pill">
                {view === 'vendedores'
                  ? `${vendedores.length} vendedores`
                  : `${(view === 'leads' ? filtered : leads).length} ${
                      (view === 'leads' ? filtered : leads).length === 1
                        ? 'lead'
                        : 'leads'
                    }`}
              </span>
            )}
            <div className="head-actions">
              {view === 'leads' && (
                <button
                  className="btn dark"
                  onClick={exportCSV}
                  disabled={filtered.length === 0}
                >
                  Exportar CSV
                </button>
              )}
            </div>
          </div>

          {error && <div className="msg error">{error}</div>}

          <div className="card">
            {(view === 'leads' || view === 'vendedores') && (
              <div className="tabs">
                <button
                  className={view === 'leads' ? 'active' : ''}
                  onClick={() => switchView('leads')}
                >
                  Leads
                </button>
                <button
                  className={view === 'vendedores' ? 'active' : ''}
                  onClick={() => switchView('vendedores')}
                >
                  Vendedores
                </button>
              </div>
            )}

            {view === 'reportes' ? (
              loading ? (
                <div className="msg">Cargando…</div>
              ) : (
                <Reportes leads={leads} vendedores={vendedores} />
              )
            ) : view === 'integracion' ? (
              <Integracion />
            ) : view === 'leads' ? (
              <>
                <div className="toolbar">
                  <select
                    className="filter-pill"
                    value={vendorFilter}
                    onChange={(e) => onVendor(e.target.value)}
                  >
                    <option value="">Todos los vendedores</option>
                    {vendedores.map((v) => (
                      <option key={v.vendedorId} value={v.vendedorId}>
                        {v.nombre}
                      </option>
                    ))}
                  </select>
                  <span className="spacer" />
                  <span className="result-note">
                    {loading
                      ? 'Cargando…'
                      : `${filtered.length} resultado${filtered.length === 1 ? '' : 's'}`}
                  </span>
                </div>
                {loading ? (
                  <div className="msg">Cargando leads…</div>
                ) : (
                  <>
                    <LeadsTable
                      leads={paged}
                      vendedores={vendedores}
                      onSelect={setSelectedLead}
                      onVendorFilter={onVendor}
                    />
                    <Pagination
                      page={pageClamped}
                      totalPages={totalPages}
                      onPage={setPage}
                    />
                  </>
                )}
              </>
            ) : loading ? (
              <div className="msg">Cargando…</div>
            ) : (
              <VendedoresTable vendedores={vendedores} stats={stats} />
            )}
          </div>
        </div>
      </div>
      <LeadDrawer
        lead={selectedLead}
        vendedores={vendedores}
        onClose={() => setSelectedLead(null)}
      />
    </div>
  );
}
