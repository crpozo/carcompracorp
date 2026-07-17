'use client';

import type { Vendedor } from '../lib/api';

export default function VendorFilter({
  vendedores,
  value,
  onChange,
  disabled,
}: {
  vendedores: Vendedor[];
  value: string;
  onChange: (vendedorId: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="filter-row">
      <label htmlFor="vendedor-filter">Filtrar por vendedor</label>
      <select
        id="vendedor-filter"
        className="control"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Todos los vendedores</option>
        {vendedores.map((v) => (
          <option key={v.vendedorId} value={v.vendedorId}>
            {v.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
