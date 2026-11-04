import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GaugeChart from '@/components/GaugeChart';
import SensorCard from '@/components/SensorCard';
import { Table } from '@/components/ui/table';
import { Droplets } from 'lucide-react';

// Criterios de accesibilidad (WCAG 2.2) cubiertos por pruebas: texto alternativo, nombre accesible y teclado.
describe('accesibilidad', () => {
  it('el medidor tiene texto alternativo con su valor y su escala', () => {
    render(<GaugeChart value={22} min={0} max={50} unit="°C" />);
    expect(screen.getByRole('img', { name: /22 °C.*0 a 50/ })).toBeTruthy();
  });

  it('la barra de progreso de un sensor tiene nombre accesible', () => {
    render(<SensorCard icon={Droplets} label="Humedad del suelo" value="62" unit="%" progress={62} color="blue" />);
    expect(screen.getByRole('progressbar', { name: /Humedad del suelo: 62 %/ })).toBeTruthy();
  });

  it('las tablas con desplazamiento se pueden enfocar con el teclado', () => {
    render(<Table><tbody><tr><td>dato</td></tr></tbody></Table>);
    const region = screen.getByRole('region', { name: /Tabla de datos/ });
    expect(region.getAttribute('tabindex')).toBe('0');
  });
});
