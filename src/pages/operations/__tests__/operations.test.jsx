import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
let permissions = [];
vi.mock('../../../lib/auth', () => ({ useAuth: () => ({ can: (key) => key.split('|').some((p) => permissions.includes(p)), enabled: () => true }) }));
vi.mock('../../../lib/api', async (load) => ({ ...(await load()), api: vi.fn() }));
import { api } from '../../../lib/api';
import { ToastProvider } from '../../../components/ui';
import { AssetDetailPage, ExpenseDetailPage, TravelDetailPage, AssetsPage } from '../OperationsPages';
import { calls, mockApi } from '../../payroll/__tests__/helpers';
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const wrap = (ui, route, path) => <ToastProvider><MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={ui} /></Routes></MemoryRouter></ToastProvider>;
describe('Assets, expenses and travel', () => {
  it('saves itinerary legs with explicit offsets and the loaded version', async () => {
    permissions = ['travel.self'];
    mockApi(api, { '/requests/t1/itinerary': { uuid: 't1' }, '/requests/t1': { uuid: 't1', destination: 'London', purpose: 'Workshop', status: 'draft', can_submit: true, itinerary: [], itinerary_version: 2 } });
    render(wrap(<TravelDetailPage />, '/travel/:uuid', '/travel/t1'));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit itinerary' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add leg' }));
    const fields = { 'Origin 1': 'Chennai', 'Destination 1': 'London', 'Departure timestamp 1': '2026-11-01T09:00:00+05:30', 'Arrival timestamp 1': '2026-11-01T15:00:00+00:00', 'Departure timezone 1': 'Asia/Kolkata', 'Arrival timezone 1': 'Europe/London' };
    Object.entries(fields).forEach(([label, value]) => fireEvent.change(screen.getByLabelText(label), { target: { value } }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Itinerary saved')).toBeInTheDocument();
    const request = calls(api, '/requests/t1/itinerary', 'PUT')[0][1];
    expect(request.method).toBe('PUT');
    expect(request.body).toEqual({ version: 2, legs: [{ origin: 'Chennai', destination: 'London', departure: fields['Departure timestamp 1'], arrival: fields['Arrival timestamp 1'], departure_timezone: 'Asia/Kolkata', arrival_timezone: 'Europe/London' }] });
  });
  it('acknowledges an asset with its current version and hides inventory controls from employees', async () => {
    permissions = ['assets.self'];
    mockApi(api, { '/assets/a1/actions': { uuid: 'a1' }, '/assets/a1': { uuid: 'a1', name: 'Laptop', identifier: 'LAP-1', status: 'assigned', version: 3, can_acknowledge: true, movements: [] } });
    render(wrap(<AssetDetailPage />, '/assets/:uuid', '/assets/a1'));
    fireEvent.click(await screen.findByRole('button', { name: 'Acknowledge receipt' }));
    expect(await screen.findByText('Asset receipt acknowledged')).toBeInTheDocument();
    expect(calls(api, '/assets/a1/actions')[0][1].body).toEqual({ action: 'acknowledge', version: 3 });
    expect(screen.queryByRole('button', { name: 'Transfer' })).not.toBeInTheDocument();
  });
  it('uploads receipt form data for a draft claim', async () => {
    permissions = ['expenses.self'];
    mockApi(api, { '/claims/c1/receipts': { uuid: 'receipt1' }, '/claims/c1': { uuid: 'c1', title: 'Meal', status: 'draft', currency: 'USD', total: '12.30', can_submit: true, receipts: [], lines: [], policy: {}, readiness: { receipt_required: true } } });
    render(wrap(<ExpenseDetailPage />, '/expenses/:uuid', '/expenses/c1'));
    fireEvent.change(await screen.findByLabelText('Expense receipt'), { target: { files: [new File(['receipt'], 'receipt.pdf', { type: 'application/pdf' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload receipt' }));
    expect(await screen.findByText('Receipt uploaded')).toBeInTheDocument();
    expect(calls(api, '/claims/c1/receipts')[0][1].body).toBeInstanceOf(FormData);
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });
  it('records a travel approval with an explicit decision reason', async () => {
    permissions = ['travel.approve'];
    mockApi(api, { '/requests/t1/actions': { uuid: 't1' }, '/requests/t1': { uuid: 't1', destination: 'London', purpose: 'Workshop', status: 'submitted', can_review: true, currency: 'GBP', budget: '200.00' } });
    render(wrap(<TravelDetailPage />, '/travel/:uuid', '/travel/t1'));
    fireEvent.click(await screen.findByRole('button', { name: 'Approve trip' }));
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Business purpose verified' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Travel request updated')).toBeInTheDocument();
    expect(calls(api, '/requests/t1/actions')[0][1].body).toEqual({ action: 'approve', reason: 'Business purpose verified' });
  });
  it('renders inventory empty state with a manager registration action', async () => {
    permissions = ['assets.manage']; mockApi(api, { '/assets': { data: [], last_page: 1 } });
    render(wrap(<AssetsPage />, '/assets', '/assets'));
    expect(await screen.findByText('No assets to show.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Register asset' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});
