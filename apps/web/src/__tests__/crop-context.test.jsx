import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '@/contexts/AuthContext';
import { CropProvider, useCrop } from '@/contexts/CropContext';

const mockPb = vi.hoisted(() => ({
  authStore: {
    isValid: true,
    model: { id: 'user-1', email: 'grower@example.com' },
    clear: vi.fn(),
  },
  collection: vi.fn(),
}));

vi.mock('@/lib/pocketbaseClient', () => ({
  default: mockPb,
  pocketbaseClient: mockPb,
}));

const crops = [
  { id: 'crop-north', userId: 'user-1', name: 'Lote norte' },
  { id: 'crop-south', userId: 'user-1', name: 'Lote sur' },
];
const getCropList = vi.fn(async () => crops);

const CropProbe = () => {
  const { crops: availableCrops, selectedCropId, selectCrop } = useCrop();
  return (
    <div>
      <span data-testid="crop-count">{availableCrops.length}</span>
      <span data-testid="selected-crop">{selectedCropId || 'none'}</span>
      <button type="button" onClick={() => selectCrop('crop-south')}>Seleccionar lote sur</button>
    </div>
  );
};

const renderCropProbe = () => render(
  <AuthProvider>
    <CropProvider>
      <CropProbe />
    </CropProvider>
  </AuthProvider>,
);

describe('crop selection', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    getCropList.mockClear();
    mockPb.authStore.isValid = true;
    mockPb.authStore.model = { id: 'user-1', email: 'grower@example.com' };
    mockPb.collection.mockImplementation((name) => {
      if (name !== 'crops') throw new Error(`Unexpected collection ${name}`);
      return { getFullList: getCropList };
    });
  });

  it('loads only the authenticated user crop list and persists the selected crop', async () => {
    const { unmount } = renderCropProbe();

    await waitFor(() => {
      expect(screen.getByTestId('crop-count')).toHaveTextContent('2');
      expect(screen.getByTestId('selected-crop')).toHaveTextContent('crop-north');
    });
    expect(getCropList).toHaveBeenCalledWith(expect.objectContaining({
      filter: 'userId = "user-1"',
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar lote sur' }));
    expect(screen.getByTestId('selected-crop')).toHaveTextContent('crop-south');
    expect(window.localStorage.getItem('neptuno:selected-crop:user-1')).toBe('crop-south');

    unmount();
    renderCropProbe();
    await waitFor(() => expect(screen.getByTestId('selected-crop')).toHaveTextContent('crop-south'));
  });
});
