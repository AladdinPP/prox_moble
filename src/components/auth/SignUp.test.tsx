import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignUp } from '@/components/auth/SignUp';

const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  checkWaitlistEmail: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    signUp: mocks.signUp,
    checkWaitlistEmail: mocks.checkWaitlistEmail,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mocks.toast,
  }),
}));

function fillStep1(overrides?: { email?: string }) {
  fireEvent.change(screen.getByLabelText(/First Name/i), {
    target: { value: 'Jane' },
  });
  fireEvent.change(screen.getByLabelText(/Last Name/i), {
    target: { value: 'Doe' },
  });
  fireEvent.change(screen.getByLabelText(/^Email/i), {
    target: { value: overrides?.email ?? 'Jane.Doe@Example.COM' },
  });
  fireEvent.change(screen.getByLabelText(/^Password/i), {
    target: { value: 'password123' },
  });
  fireEvent.change(screen.getByLabelText(/Confirm Password/i), {
    target: { value: 'password123' },
  });
}

describe('SignUp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.signUp.mockResolvedValue({ error: null });
  });

  it('checks account status with normalized email and redirects to sign-in when account exists', async () => {
    const switchToSignIn = vi.fn();
    mocks.checkWaitlistEmail.mockResolvedValue({
      status: 'has_account',
      message: 'exists',
    });

    render(<SignUp onSuccess={vi.fn()} onSwitchToSignIn={switchToSignIn} />);

    fillStep1({ email: 'Jane.Doe@Example.COM' });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(mocks.checkWaitlistEmail).toHaveBeenCalledWith('jane.doe@example.com');
      expect(switchToSignIn).toHaveBeenCalledWith('jane.doe@example.com');
    });

    expect(screen.queryByLabelText(/Zip Code/i)).not.toBeInTheDocument();
  });

  it('prefills legacy waitlist data and submits normalized payload', async () => {
    mocks.checkWaitlistEmail.mockResolvedValue({
      status: 'legacy_waitlist',
      message: 'legacy',
      existing_data: {
        first_name: 'Legacy',
        last_name: 'User',
        zip_code: '90210-1234',
        phone_number: '(222) 333-4444',
        preferred_retailers: ['Walmart', 'Target'],
        date_of_birth: '1990-05-17',
      },
    });

    render(<SignUp onSuccess={vi.fn()} onSwitchToSignIn={vi.fn()} />);

    fillStep1({ email: 'Legacy.User@Example.COM' });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await screen.findByLabelText(/Zip Code/i);

    expect(screen.getByLabelText(/Zip Code/i)).toHaveValue('90210');
    expect(screen.getByLabelText(/Birthday/i)).toHaveValue('05/17/1990');

    fireEvent.change(screen.getByLabelText(/Household Size/i), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Male' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await screen.findByText(/Where do you usually shop/i);

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(mocks.signUp).toHaveBeenCalledWith(
        'legacy.user@example.com',
        'password123',
        expect.objectContaining({
          phone_number: '2223334444',
          zip_code: '90210',
          birthday: '1990-05-17',
          grocer_1: 'Walmart',
          grocer_2: 'Target',
        })
      );
    });

    expect(await screen.findByText(/Check Your Email/i)).toBeInTheDocument();
  });
});
