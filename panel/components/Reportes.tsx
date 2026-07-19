'use client';

import type { Lead, Vendedor } from '../lib/api';
import Avatar from './Avatar';
import StatusBadge from './StatusBadge';

const DAY_MS = 86_400_000;
const ESTADOS_ORDEN = ['nuevo', 'contactado', 'interesado', 'cerrado', 'perdido'];

// Clave de día en hora LOCAL (YYYY-MM-DD) — los leads llegan en ISO/UTC.
function dayKey(d: Date): string {
  return d.toLocaleDateString('en-CA');
}

function shortDay(d: Date): string {
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' });
}

export default function Reportes({
  leads,
  vendedores,
}: {
  leads: Lead[];
  vendedores: Vendedor[];
}) {
  const now = new Date();
  const hoyKey = dayKey(now);

  // ---- KPIs ----
  const total = leads.length;
  const hoy = leads.filter((l) => dayKey(new Date(l.creadoEn)) === hoyKey).length;
  const semana = leads.filter(
    (l) => now.getTime() - new Date(l.creadoEn).getTime() < 7 * DAY_MS
  ).length;
  const sinAsignar = leads.filter((l) => !l.vendedorId).length;

  // ---- Leads por vendedor (una sola serie → un solo color) ----
  const porVendedor = vendedores
    .map((v) => ({
      v,
      n: leads.filter((l) => l.vendedorId === v.vendedorId).length,
    }))
    .sort((a, b) => b.n - a.n);
  const maxVend = Math.max(1, ...porVendedor.map((x) => x.n));

  // ---- Por estado ----
  const porEstado = ESTADOS_ORDEN.map((e) => ({
    e,
    n: leads.filter((l) => (l.estado ?? '').toLowerCase() === e).length,
  }));

  // ---- Top anuncios ----
  const anuncioCount = new Map<string, number>();
  for (const l of leads) {
    const a = l.anuncioOrigen?.trim();
    if (!a) continue;
    anuncioCount.set(a, (anuncioCount.get(a) ?? 0) + 1);
  }
  const topAnuncios = [...anuncioCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxAnuncio = Math.max(1, ...topAnuncios.map(([, n]) => n));

  // ---- Últimos 14 días ----
  const dias: { key: string; label: string; n: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY_MS);
    dias.push({ key: dayKey(d), label: shortDay(d), n: 0 });
  }
  const diaIdx = new Map(dias.map((d, i) => [d.key, i]));
  for (const l of leads) {
    const idx = diaIdx.get(dayKey(new Date(l.creadoEn)));
    if (idx !== undefined) dias[idx].n += 1;
  }
  const maxDia = Math.max(1, ...dias.map((d) => d.n));

  return (
    <div className="report-wrap">
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="k-label">Total de leads</div>
          <div className="k-value">{total}</div>
        </div>
        <div className="kpi-card">
          <div className="k-label">Hoy</div>
          <div className="k-value">{hoy}</div>
        </div>
        <div className="kpi-card">
          <div className="k-label">Últimos 7 días</div>
          <div className="k-value">{semana}</div>
        </div>
        <div className="kpi-card">
          <div className="k-label">Sin asignar</div>
          <div className="k-value">{sinAsignar}</div>
        </div>
      </div>

      <section className="report-section">
        <h3>Leads por día · últimos 14 días</h3>
        <div className="vbars">
          {dias.map((d) => (
            <div
              className="vbar-col"
              key={d.key}
              title={`${d.label}: ${d.n} ${d.n === 1 ? 'lead' : 'leads'}`}
            >
              <div className="vbar-n">{d.n > 0 ? d.n : ''}</div>
              <div
                className={`vbar${d.n === 0 ? ' zero' : ''}`}
                style={{ height: `${Math.max(4, (d.n / maxDia) * 92)}px` }}
              />
              <div className="vbar-d">{d.label.split(' ')[0]}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="report-section">
        <h3>Leads por vendedor</h3>
        {porVendedor.length === 0 ? (
          <p className="int-note">No hay vendedores cargados.</p>
        ) : (
          porVendedor.map(({ v, n }) => (
            <div className="hbar-row" key={v.vendedorId} title={`${v.nombre}: ${n}`}>
              <div className="hbar-label">
                <Avatar name={v.nombre} />
                <span>{v.nombre}</span>
              </div>
              <div className="hbar-track">
                <div
                  className="hbar-fill"
                  style={{ width: `${(n / maxVend) * 100}%` }}
                />
              </div>
              <div className="hbar-n">{n}</div>
            </div>
          ))
        )}
      </section>

      <section className="report-section">
        <h3>Por estado</h3>
        <div className="estado-counts">
          {porEstado.map(({ e, n }) => (
            <div className="estado-count" key={e}>
              <StatusBadge estado={e} /> {n}
            </div>
          ))}
        </div>
      </section>

      <section className="report-section">
        <h3>Top anuncios (origen de los leads)</h3>
        {topAnuncios.length === 0 ? (
          <p className="int-note">
            Aún no hay leads con anuncio de origen — aparecerán cuando lleguen
            desde la pauta.
          </p>
        ) : (
          topAnuncios.map(([a, n]) => (
            <div className="hbar-row" key={a} title={`${a}: ${n}`}>
              <div className="hbar-label">
                <span>{a}</span>
              </div>
              <div className="hbar-track">
                <div
                  className="hbar-fill"
                  style={{ width: `${(n / maxAnuncio) * 100}%` }}
                />
              </div>
              <div className="hbar-n">{n}</div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
