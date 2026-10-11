export { send, useList } from './timeOfficeApi';
export const operationPaths = {
  assets: '/v1/assets', employees: '/v1/assets/employees',
  asset: (uuid, part = '') => `/v1/assets/${uuid}${part ? `/${part}` : ''}`,
  policies: '/v1/expenses/policies', claims: '/v1/expenses/claims',
  claim: (uuid, part = '') => `/v1/expenses/claims/${uuid}${part ? `/${part}` : ''}`,
  trips: '/v1/travel/requests', trip: (uuid, part = '') => `/v1/travel/requests/${uuid}${part ? `/${part}` : ''}`,
};
export const currencyOptions = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'KWD'].map((value) => ({ value, label: value }));
export const operationPermissions = {
  assets: 'assets.self|assets.manage', expenses: 'expenses.self|expenses.approve|expenses.manage|expenses.payments.confirm', travel: 'travel.self|travel.approve',
};
