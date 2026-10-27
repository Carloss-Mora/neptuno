import React, { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AreaInput from '@/components/AreaInput';
import { toM2, fromM2, formatArea } from '@/utils/area';

function Harness() {
  const [v, setV] = useState('');
  return (<><AreaInput id="a" valueM2={v} onChangeM2={setV} /><output data-testid="m2">{v}</output></>);
}

describe('área en m² y hectáreas', () => {
  it('convierte', () => {
    expect(toM2('2,5', 'ha')).toBe(25000);
    expect(fromM2(5000, 'ha')).toBe('0.5');
    expect(formatArea(25000)).toBe('2,5 ha');
    expect(formatArea(120)).toBe('120 m²');
    expect(formatArea(0)).toBe('');
  });
  it('guarda siempre en m² y conserva el valor al cambiar de unidad', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByRole('spinbutton'), '120');
    expect(screen.getByTestId('m2')).toHaveTextContent('120');
    await user.selectOptions(screen.getByLabelText('Unidad del área'), 'ha');
    expect(screen.getByRole('spinbutton')).toHaveValue(0.012);
    await user.clear(screen.getByRole('spinbutton'));
    await user.type(screen.getByRole('spinbutton'), '1.5');
    expect(screen.getByTestId('m2')).toHaveTextContent('15000');
  });
});
