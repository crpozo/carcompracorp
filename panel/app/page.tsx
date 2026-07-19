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
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import LeadsTable from '../components/LeadsTable';
import Pagination from '../components/Pagination';
import VendedoresTable from '../components/VendedoresTable';
import Providers from './providers';

type View = 'leads' | 'vendedores';
const PAGE_SIZE = 8;

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
        if (!cancelled) setEmail(a.email ?? '');
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
      return [l.nombre, l.telefono, l.anuncioOrigen, l.mensaje, nameFor(l.vendedorId)]
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
              <div className="crumb">Contactos</div>
              <h1>{view === 'leads' ? 'Mis Leads' : 'Vendedores'}</h1>
            </div>
            <span className="count-pill">
              {view === 'leads'
                ? `${filtered.length} ${filtered.length === 1 ? 'lead' : 'leads'}`
                : `${vendedores.length} vendedores`}
            </span>
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

            {view === 'leads' ? (
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
                    <LeadsTable leads={paged} vendedores={vendedores} />
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
    </div>
  );
}
