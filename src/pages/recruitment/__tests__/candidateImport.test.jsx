import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let perms = ['recruitment.manage'];
vi.mock('../../../lib/auth', () => ({
  useAuth: () => ({ can: (p) => !p || p.split('|').some((k) => perms.includes(k)), enabled: () => true }),
}));
vi.mock('../../../lib/api', async (orig) => ({ ...(await orig()), api: vi.fn() }));
import { api } from '../../../lib/api';
import { ToastProvider } from '../../../components/ui';
import CandidateImportPage from '../CandidateImportPage';
import { apiError } from '../../payroll/__tests__/helpers';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  perms = ['recruitment.manage'];
});

const PREVIEW = {
  uuid: 'imp-1',
  expires_at: '2030-01-01T00:00:00Z',
  rows: [
    { row: 1, name: 'Ada Lovelace', email: 'ada@example.com', errors: [] },
    { row: 2, name: 'Bad Row', email: 'dup@example.com', errors: ['Duplicate email: review separately; this row will not be imported.'] },
  ],
};

const show = () =>
  render(
    <ToastProvider>
      <MemoryRouter>
        <CandidateImportPage />
      </MemoryRouter>
    </ToastProvider>,
  );

async function toPreview() {
  api.mockResolvedValueOnce(PREVIEW);
  show();
  const file = new File(['name,email\n'], 'c.csv', { type: 'text/csv' });
  fireEvent.change(screen.getByLabelText('CSV file'), { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: 'Upload and preview' }));
  await screen.findByText('1 row(s) will be skipped');
}

describe('Candidate import', () => {
  it('rejects non-CSV files before upload', () => {
    show();
    fireEvent.change(screen.getByLabelText('CSV file'), { target: { files: [new File(['x'], 'c.txt')] } });
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a .csv file.');
    expect(screen.getByRole('button', { name: 'Upload and preview' })).toBeDisabled();
  });

  it('shows per-row errors and the skip warning', async () => {
    await toPreview();
    expect(api.mock.calls[0][0]).toBe('/v1/recruitment/imports/candidates');
    expect(api.mock.calls[0][1].body).toBeInstanceOf(FormData);
    expect(screen.getAllByText(/Duplicate email/).length).toBeGreaterThan(0);
    expect(screen.getByText(/are not imported/)).toBeInTheDocument();
  });

  it('requires the confirm checkbox before commit, then summarises the result', async () => {
    await toPreview();
    const button = screen.getByRole('button', { name: 'Import 1 candidate(s)' });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(button).toBeEnabled();
    api.mockResolvedValueOnce({
      uuid: 'imp-1',
      rows: [
        { row: 1, status: 'imported', candidate_uuid: 'c-1', errors: [] },
        { row: 2, status: 'skipped', candidate_uuid: null, errors: ['Duplicate email'] },
      ],
    });
    fireEvent.click(button);
    expect(await screen.findByText('1 imported, 1 skipped.')).toBeInTheDocument();
    const [path, opts] = api.mock.calls[1];
    expect(path).toBe('/v1/recruitment/imports/candidates/imp-1/commit');
    expect(opts).toMatchObject({ method: 'POST', body: { confirmed: true } });
    expect(screen.getAllByText('Duplicate email').length).toBeGreaterThan(0);
  });

  it('explains an expired preview on 410', async () => {
    await toPreview();
    fireEvent.click(screen.getByRole('checkbox'));
    api.mockRejectedValueOnce(apiError('Import expired. Upload the file again.', 410));
    fireEvent.click(screen.getByRole('button', { name: 'Import 1 candidate(s)' }));
    await waitFor(() => expect(screen.getByText('This preview has expired')).toBeInTheDocument());
    expect(screen.getByText(/Upload the file again to continue/)).toBeInTheDocument();
  });

  it('blocks users without recruitment.manage', () => {
    perms = ['recruitment.view'];
    show();
    expect(screen.getByText('Access restricted')).toBeInTheDocument();
  });
});
