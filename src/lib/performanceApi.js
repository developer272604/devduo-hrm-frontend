import { query } from './api';

export { listOf, pageOf, send, today, unwrap, useAction, useList, useLookup } from './timeOfficeApi';
export { query };

export const P = '/v1/performance';
export const paths = {
  goals: `${P}/goals`,
  goal: (uuid, part = '') => `${P}/goals/${uuid}${part ? `/${part}` : ''}`,
  cycles: `${P}/cycles`,
  cycle: (uuid, part = '') => `${P}/cycles/${uuid}${part ? `/${part}` : ''}`,
  templates: `${P}/templates`,
  reviews: `${P}/reviews`,
  review: (uuid, part = '') => `${P}/reviews/${uuid}${part ? `/${part}` : ''}`,
  response: (uuid) => `${P}/review-responses/${uuid}/submit`,
  dashboard: `${P}/dashboard`,
};

export const NAV = [
  { to: '/performance/goals', label: 'Goals and OKRs', permission: 'performance.self|performance.view' },
  { to: '/performance/reviews', label: 'Reviews', permission: 'performance.self|performance.view' },
  { to: '/performance/cycles', label: 'Cycles', permission: 'performance.cycles.manage' },
  { to: '/performance/dashboard', label: 'Dashboard', permission: 'performance.reports.view' },
];
export const PERFORMANCE_ACCESS = [...new Set(NAV.flatMap((n) => n.permission.split('|')))].join('|');

export const titleCase = (s) => String(s ?? '').replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
export const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== null && v !== undefined));

