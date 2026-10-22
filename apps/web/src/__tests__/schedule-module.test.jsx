import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import IrrigationScheduleForm from '@/components/IrrigationScheduleForm';
import ScheduledIrrigationList from '@/components/ScheduledIrrigationList';

describe('Schedule form module', () => {
  it('shows start/end time and a date field when creating a new schedule', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => ({ success: true }));

    render(<IrrigationScheduleForm onSave={onSave} />);

    expect(screen.queryByText(/días de la semana/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/hora de inicio/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hora de finalización/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/fecha/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /periodo de inicio pm/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /periodo de finalización pm/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /periodo de inicio am/i })).toHaveAttribute('aria-pressed', 'true');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowValue = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    fireEvent.change(screen.getByLabelText(/fecha/i), { target: { value: tomorrowValue } });

    await user.click(screen.getByRole('button', { name: /guardar horario/i }));

    expect(onSave).toHaveBeenCalledWith(
      expect.stringMatching(/^\d{2}:\d{2}$/),
      expect.stringMatching(/^\d{2}:\d{2}$/),
      expect.any(String)
    );
  });

  it('converts PM start and end times to 24-hour values', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => ({ success: true }));

    render(<IrrigationScheduleForm onSave={onSave} />);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowValue = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    fireEvent.change(screen.getByLabelText(/fecha/i), { target: { value: tomorrowValue } });
    fireEvent.change(screen.getByLabelText(/hora de inicio/i), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText(/hora de finalización/i), { target: { value: '7' } });
    await user.click(screen.getByRole('button', { name: /periodo de inicio pm/i }));
    await user.click(screen.getByRole('button', { name: /periodo de finalización pm/i }));
    expect(screen.getByRole('button', { name: /periodo de inicio pm/i })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: /guardar horario/i }));

    expect(onSave).toHaveBeenCalledWith('18:00', '19:00', tomorrowValue);
  });

  it('prevents updating an existing schedule after its original time passed', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => ({ success: true }));
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayValue = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    render(
      <IrrigationScheduleForm
        initialData={{ id: 'schedule-1', date: yesterdayValue, startTime: '08:00', endTime: '09:00' }}
        onSave={onSave}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/hora de inicio/i)).toHaveValue(8);
      expect(screen.getByLabelText(/fecha/i)).toHaveValue(yesterdayValue);
    });
    expect(screen.getByRole('status')).toHaveTextContent('Este horario ya pasó y no se puede editar.');
    expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('marks completed schedules as passed and prevents editing them', async () => {
    const referenceDate = new Date(2026, 9, 20, 12, 0);
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <ScheduledIrrigationList
        schedules={[
          { id: 'past', date: '2026-10-20', startTime: '08:00', endTime: '09:00' },
          { id: 'future', date: '2026-10-20', startTime: '13:00', endTime: '14:00' },
        ]}
        referenceDate={referenceDate}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    expect(screen.getAllByText('Ya pasó')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'No editable' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeEnabled();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Editar' }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'future' }));
  });
});
