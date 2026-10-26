import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, describeOtpDelivery, useAuth } from '@/contexts/AuthContext';

const mockPb = vi.hoisted(() => ({
  authStore: { isValid: false, model: null, clear: vi.fn() },
  collection: vi.fn(),
  send: vi.fn(),
}));

vi.mock('@/lib/pocketbaseClient', () => ({ default: mockPb, pocketbaseClient: mockPb }));

const Probe = () => {
  const { resendVerification } = useAuth();
  const [text, setText] = React.useState('');
  return (
    <>
      <button type="button" onClick={async () => {
        try {
          const result = await resendVerification('ana@example.com');
          setText(`${result.delivered ? 'ok' : 'fail'}: ${result.message}`);
        } catch (error) {
          setText(`error: ${error.message}`);
        }
      }}
      >
        pedir
      </button>
      <span data-testid="out">{text}</span>
    </>
  );
};

const renderProbe = () => render(<AuthProvider><Probe /></AuthProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  mockPb.collection.mockImplementation(() => ({ requestOTP: vi.fn(async () => ({ otpId: 'abcdefghij1234' })) }));
});

describe('describeOtpDelivery', () => {
  it('maps each server status to an honest Spanish message', () => {
    expect(describeOtpDelivery({ status: 'sent' }, 'a@b.co')).toMatchObject({ delivered: true, message: expect.stringContaining('Te enviamos un código a a@b.co') });
    expect(describeOtpDelivery({ status: 'failed', reason: 'not_configured' }, 'a@b.co').message).toMatch(/no tiene el correo configurado/);
    expect(describeOtpDelivery({ status: 'failed', reason: 'provider_rejected' }, 'a@b.co').message).toMatch(/Resend/);
    expect(describeOtpDelivery({ status: 'failed', reason: 'smtp_failed' }, 'a@b.co').message).toMatch(/SMTP/);
    expect(describeOtpDelivery({ status: 'failed', reason: 'unknown' }, 'a@b.co').delivered).toBe(false);
    expect(describeOtpDelivery({ status: 'pending' }, 'a@b.co').message).toMatch(/tarda más de lo normal/);
  });
});

describe('requesting a verification code', () => {
  it('reports success only once the server confirms the email was sent', async () => {
    mockPb.send.mockResolvedValue({ status: 'sent', reason: '' });
    renderProbe();
    await userEvent.click(screen.getByText('pedir'));
    await waitFor(() => expect(screen.getByTestId('out')).toHaveTextContent('ok: Te enviamos un código a ana@example.com'));
    expect(mockPb.send).toHaveBeenCalledWith(expect.stringContaining('otpId=abcdefghij1234'), expect.anything());
  });

  it('reports failure when the provider rejected the email even though request-otp returned 200', async () => {
    mockPb.send.mockResolvedValue({ status: 'failed', reason: 'provider_rejected' });
    renderProbe();
    await userEvent.click(screen.getByText('pedir'));
    await waitFor(() => expect(screen.getByTestId('out')).toHaveTextContent('fail: El proveedor de correo rechazó el envío'));
  });

  it('maps the 429 rate limit to a clear message', async () => {
    mockPb.collection.mockImplementation(() => ({
      requestOTP: vi.fn(async () => { throw Object.assign(new Error('Too many requests'), { status: 429 }); }),
    }));
    renderProbe();
    await userEvent.click(screen.getByText('pedir'));
    await waitFor(() => expect(screen.getByTestId('out')).toHaveTextContent('Demasiados intentos. Espera unos minutos'));
  });
});
