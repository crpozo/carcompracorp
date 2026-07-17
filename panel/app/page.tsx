'use client';

import { useCallback, useEffect, useState } from 'react';
import { signOut } from 'aws-amplify/auth';
import {
  getLeads,
  getStats,
  getVendedores,
  type Lead,
  type Stats as StatsType,
  type Vendedor,
} from '../lib/api';
import Stats from '../components/Stats';
import VendorFilter from '../components/VendorFilter';
import LeadsTable from '../components/LeadsTable';

export default function DashboardPage() {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [stats, setStats] = useState<StatsType | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedVendedor, setSelectedVendedor] = useState<string>('');
  const [loadingLeads, setLoadingLeads] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load the reference data (vendedores + stats) plus the initial, unfiltered
  // leads once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const [vend, st, initialLeads] = await Promise.all([
          getVendedores(),
          getStats(),
          getLeads(),
        ]);
        if (cancelled) return;
        setVendedores(vend);
        setStats(st);
        setLeads(initialLeads);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Error al cargar el panel.');
      } finally {
        if (!cancelled) setLoadingLeads(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Refetch leads whenever the vendedor filter changes.
  const applyFilter = useCallback(async (vendedorId: string) => {
    setSelectedVendedor(vendedorId);
    setLoadingLeads(true);
    setError(null);
    try {
      const rows = await getLeads(vendedorId || undefined);
      setLeads(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar los leads.');
    } finally {
      setLoadingLeads(false);
    }
  }, []);

  return (
    <main className="page">
      <div className="topbar">
        <div>
          <h1>CarCompra · Panel de Leads</h1>
          <div className="who">Vista de supervisión (solo lectura)</div>
        </div>
        <button className="btn" onClick={() => signOut()}>
          Cerrar sesión
        </button>
      </div>

      {error && <div className="msg error">{error}</div>}

      <section className="section">
        <h2>Resumen</h2>
        <Stats stats={stats} vendedores={vendedores} />
      </section>

      <section className="section">
        <h2>Leads</h2>
        <VendorFilter
          vendedores={vendedores}
          value={selectedVendedor}
          onChange={applyFilter}
          disabled={loadingLeads}
        />
        <div style={{ height: 14 }} />
        {loadingLeads ? (
          <div className="table-wrap">
            <div className="msg">Cargando leads…</div>
          </div>
        ) : (
          <LeadsTable leads={leads} vendedores={vendedores} />
        )}
      </section>
    </main>
  );
}
