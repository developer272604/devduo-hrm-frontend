import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let perms = [];
vi.mock('../../../lib/auth', () => ({
  useAuth: () => ({ can: (p) => !p || p.split('|').some((k) => perms.includes(k)), enabled: () => true }),
}));
vi.mock('../../../lib/api', async (orig) => ({ ...(await orig()), api: vi.fn(), download: vi.fn() }));
import { api, download } from '../../../lib/api';
import { ToastProvider } from '../../../components/ui';
import ResumesPanel from '../../../components/recruitment/ResumesPanel';
import OfferDocumentsModal from '../../../components/recruitment/OfferDocumentsModal';
import OfferTemplatesPage from '../OfferTemplatesPage';
import { apiError, calls, mockApi } from '../../payroll/__tests__/helpers';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const wrap = (ui) => (
  <ToastProvider>
    <MemoryRouter>{ui}</MemoryRouter>
  </ToastProvider>
);
const resume = { version: 2, original_name: 'cv.pdf', mime: 'application/pdf', size: 2048, uploaded_at: '2026-10-01T10:00:00Z', available: true };
const fileOf = (name, size = 100) => {
  const f = new File(['x'], name, { type: 'application/octet-stream' });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};
const choose = (f) => fireEvent.change(screen.getByLabelText('Resume file'), { target: { files: [f] } });

describe('ResumesPanel', () => {
  it('rejects bad type and size on the client, then uploads a valid file as multipart', async () => {
    perms = ['recruitment.view', 'recruitment.manage'];
    mockApi(api, { '/resumes': (p, o) => (o.method === 'POST' ? { version: 3 } : { data: [resume] }) });
    render(wrap(<ResumesPanel candidateUuid="c1" />));
    await screen.findByText('cv.pdf');
    choose(fileOf('evil.exe'));
    fireEvent.click(screen.getByRole('button', { name: /Upload resume/ }));
    expect(await screen.findByText(/Only PDF, DOC or DOCX/)).toBeInTheDocument();
    choose(fileOf('big.pdf', 6 * 1024 * 1024));
    fireEvent.click(screen.getByRole('button', { name: /Upload resume/ }));
    expect(await screen.findByText('The file is larger than 5 MB.')).toBeInTheDocument();
    expect(calls(api, '/resumes')).toHaveLength(0);
    choose(fileOf('ok.docx'));
    fireEvent.click(screen.getByRole('button', { name: /Upload resume/ }));
    await waitFor(() => expect(calls(api, '/resumes')).toHaveLength(1));
    expect(calls(api, '/resumes')[0][1].body).toBeInstanceOf(FormData);
  });
  it('downloads through the authorized helper', async () => {
    perms = ['recruitment.view'];
    mockApi(api, { '/resumes': { data: [resume] } });
    download.mockResolvedValue();
    render(wrap(<ResumesPanel candidateUuid="c1" />));
    fireEvent.click(await screen.findByRole('button', { name: 'Download resume version 2' }));
    await waitFor(() => expect(download).toHaveBeenCalledWith('/v1/recruitment/candidates/c1/resumes/2/download', 'cv.pdf'));
    expect(screen.queryByLabelText('Resume file')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove resume/ })).not.toBeInTheDocument();
  });
  it('asks for confirmation before removing', async () => {
    perms = ['recruitment.view', 'recruitment.manage'];
    mockApi(api, { '/resumes/2': {}, '/resumes': { data: [resume] } });
    render(wrap(<ResumesPanel candidateUuid="c1" />));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove resume version 2' }));
    expect(calls(api, '/resumes/2', 'DELETE')).toHaveLength(0);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove resume' }));
    await waitFor(() => expect(calls(api, '/resumes/2', 'DELETE')).toHaveLength(1));
  });
  it('shows the 403 state', async () => {
    perms = ['recruitment.view'];
    mockApi(api, { '/resumes': apiError('Forbidden', 403) });
    render(wrap(<ResumesPanel candidateUuid="c1" />));
    expect(await screen.findByText('Access restricted')).toBeInTheDocument();
  });
});

describe('OfferDocumentsModal', () => {
  const docs = { data: [{ uuid: 'd1', version: 1, template_version: 1, trigger: 'approved', generated_at: '2026-10-01T10:00:00Z', available: true }] };
  const open = (status) => {
    mockApi(api, { '/documents': docs });
    render(wrap(<OfferDocumentsModal offer={{ uuid: 'o1', candidate_name: 'Asha', status }} onClose={() => {}} />));
  };
  it('offers Generate for approved offers when the user can manage', async () => {
    perms = ['recruitment.offer.manage'];
    open('approved');
    expect(await screen.findByRole('button', { name: 'Generate document' })).toBeInTheDocument();
    expect(screen.getByText(/payroll\.compensation\.view/)).toBeInTheDocument();
  });
  it('hides Generate for draft offers', async () => {
    perms = ['recruitment.offer.manage'];
    open('draft');
    await screen.findByText('v1');
    expect(screen.queryByRole('button', { name: 'Generate document' })).not.toBeInTheDocument();
  });
  it('hides Generate for approvers without manage but still lists versions', async () => {
    perms = ['recruitment.offer.approve'];
    open('sent');
    await screen.findByText('v1');
    expect(screen.queryByRole('button', { name: 'Generate document' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open print view for version 1' })).toBeInTheDocument();
  });
  it('posts to regenerate', async () => {
    perms = ['recruitment.offer.manage'];
    open('sent');
    fireEvent.click(await screen.findByRole('button', { name: 'Generate document' }));
    await waitFor(() => expect(calls(api, '/o1/documents')).toHaveLength(1));
  });
});

describe('OfferTemplatesPage', () => {
  const list = { merge_fields: ['candidate_name', 'job_title'], data: [{ uuid: 't1', code: 'std', version: 1, name: 'Standard', status: 'active', body: '<p>Hi {{candidate_name}}</p>', created_at: '2026-10-01T10:00:00Z' }] };
  const fill = async () => {
    mockApi(api, { '/offer-templates': (p, o) => (o.method === 'POST' ? { uuid: 'n' } : list) });
    render(wrap(<OfferTemplatesPage />));
    fireEvent.click(await screen.findByRole('button', { name: 'New template' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Code'), { target: { value: 'new' } });
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'New' } });
    return dialog;
  };
  it('lists templates by code with the active version', async () => {
    perms = ['recruitment.offer.manage'];
    mockApi(api, { '/offer-templates': list });
    render(wrap(<OfferTemplatesPage />));
    expect((await screen.findAllByText('std')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/v1/).length).toBeGreaterThan(0);
  });
  it('blocks unknown merge fields with an inline error and no request', async () => {
    perms = ['recruitment.offer.manage'];
    const dialog = await fill();
    fireEvent.change(within(dialog).getByLabelText('Body'), { target: { value: 'Dear {{candidate_name}} {{salary}}' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create version' }));
    expect(await within(dialog).findByText(/Unknown merge fields: salary/)).toBeInTheDocument();
    expect(calls(api, '/offer-templates')).toHaveLength(0);
  });
  it('shows a server validation message for the body', async () => {
    perms = ['recruitment.offer.manage'];
    mockApi(api, { '/offer-templates': (p, o) => { if (o.method === 'POST') throw Object.assign(new Error('x'), { status: 422, errors: { body: ['Server says no.'] } }); return list; } });
    render(wrap(<OfferTemplatesPage />));
    fireEvent.click(await screen.findByRole('button', { name: 'New template' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Code'), { target: { value: 'new' } });
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'New' } });
    fireEvent.change(within(dialog).getByLabelText('Body'), { target: { value: 'Hello' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create version' }));
    expect(await within(dialog).findByText('Server says no.')).toBeInTheDocument();
  });
});
