import { query } from './api';

/**
 * Payroll API helpers. Every endpoint the Payroll screens use is named here, so a backend path change is a one-line edit.
 * Paths are relative to `/api` (see lib/api.js). Money is always a decimal STRING and is never recalculated in the browser.
 */
export {
  addDays,
  listOf,
  pageOf,
  send,
  titleCase,
  today,
  unwrap,
  useAction,
  useList,
  useLookup,
} from './timeOfficeApi';
export { query };

export const P = '/v1/payroll';
export const C = '/v1/compensation';
export const B = '/v1/benefits';
export const paths = {
  commandCenter: `${P}/command-center`,
  readiness: `${P}/readiness`,
  groups: `${P}/groups`,
  group: (uuid, part) => `${P}/groups/${uuid}${part ? `/${part}` : ''}`,
  calendarGenerate: (uuid) => `${P}/calendars/${uuid}/generate`,
  periods: `${P}/periods`,
  period: (uuid, part) => `${P}/periods/${uuid}${part ? `/${part}` : ''}`,
  employees: `${P}/employees`,
  components: `${P}/components`,
  component: (uuid, part) => `${P}/components/${uuid}${part ? `/${part}` : ''}`,
  formulaCheck: `${P}/formulas/check`,
  structures: `${C}/structures`,
  structure: (uuid, part) => `${C}/structures/${uuid}${part ? `/${part}` : ''}`,
  empCompensation: (uuid, part) => `${C}/employees/${uuid}/compensation${part ? `/${part}` : ''}`,
  revisions: `${C}/revisions`,
  inputImports: `${P}/inputs/imports`,
  inputImportPreview: `${P}/inputs/imports/preview`,
  inputImport: (uuid, part) => `${P}/inputs/imports/${uuid}${part ? `/${part}` : ''}`,
  revisionPreview: `${C}/revisions/preview`,
  revisionBatches: `${C}/revision-batches`,
  revisionBatch: (uuid) => `${C}/revision-batches/${uuid}`,
  compensationImportPreview: `${C}/imports/compensation/preview`,
  compensationImportCommit: (uuid) => `${C}/imports/compensation/${uuid}/commit`,
  revision: (uuid, part) => `${C}/revisions/${uuid}${part ? `/${part}` : ''}`,
  compensations: `${P}/compensations`,
  compensationDecision: (uuid) => `${P}/compensations/${uuid}/decision`,
  countryPacks: `${P}/country-packs`,
  countryPack: (uuid, part) => `${P}/country-packs/${uuid}${part ? `/${part}` : ''}`,
  packSample: `${P}/country-packs/samples/install`,
  packVersion: (uuid, part) => `${P}/country-pack-versions/${uuid}${part ? `/${part}` : ''}`,
  runs: `${P}/runs`,
  runPreview: `${P}/runs/preview`,
  run: (uuid, part) => `${P}/runs/${uuid}${part ? `/${part}` : ''}`,
  runEmployee: (uuid, emp) => `${P}/runs/${uuid}/employees/${emp}`,
  runResult: (uuid, emp, part) => `${P}/runs/${uuid}/results/${emp}${part ? `/${part}` : ''}`,
  waive: (issue) => `${P}/validations/${issue}/waive`,
  explain: (emp) => `${P}/explain/employees/${emp}`,
  differenceEmployee: (emp) => `${P}/difference/employees/${emp}`,
  purposes: `${P}/sensitive-access/purposes`,
  runPayslips: (uuid, part) => `${P}/runs/${uuid}/payslips${part ? `/${part}` : ''}`,
  payslip: (uuid, part) => `${P}/payslips/${uuid}${part ? `/${part}` : ''}`,
  payments: `${P}/payments`,
  payment: (uuid, part) => `${P}/payments/${uuid}${part ? `/${part}` : ''}`,
  runPayments: (uuid) => `${P}/runs/${uuid}/payments`,
  paymentFormats: `${P}/payment-formats`,
  bankFile: (uuid) => `${P}/bank-files/${uuid}/download`,
  accFormats: `${P}/accounting/formats`,
  accMappings: `${P}/accounting/mappings`,
  accMappingDeactivate: (uuid) => `${P}/accounting/mappings/${uuid}/deactivate`,
  journalPreview: (uuid) => `${P}/runs/${uuid}/journal/preview`,
  journalExport: (uuid) => `${P}/runs/${uuid}/journal/export`,
  journalExports: (uuid) => `${P}/runs/${uuid}/journal/exports`,
  accDownload: (uuid) => `${P}/accounting/exports/${uuid}/download`,
  reports: `${P}/reports`,
  report: (key) => `${P}/reports/${key}`,
  reportExport: (key) => `${P}/reports/${key}/export`,
  exports: `${P}/exports`,
  exportDownload: (uuid) => `${P}/exports/${uuid}/download`,
  settlements: `${P}/settlements`,
  settlement: (uuid, part) => `${P}/settlements/${uuid}${part ? `/${part}` : ''}`,
  mePayslips: `${P}/me/payslips`,
  mePayslip: (uuid, part) => `${P}/me/payslips/${uuid}${part ? `/${part}` : ''}`,
  meCompensation: `${P}/me/compensation`,
  meLoans: `${P}/me/loans`,
  meTaxWindows: `${P}/me/tax-declaration-windows`,
  meTaxSchema: `${P}/me/tax-declaration-schema`,
  meTaxDeclarations: `${P}/me/tax-declarations`,
  benefitPlansAvailable: `${B}/available`,
  benefitPlans: `${B}/plans`,
  benefitPlan: (uuid, part) => `${B}/plans/${uuid}${part ? `/${part}` : ''}`,
  benefitEnrollments: `${B}/enrollments`,
  benefitEnrollmentDecision: (uuid) => `${B}/enrollments/${uuid}/decision`,
  benefitTerminationDecision: (uuid) => `${B}/enrollments/${uuid}/termination-decision`,
  meBenefits: `${B}/me`,
  meBenefitTermination: (uuid) => `${B}/me/${uuid}/termination`,
  enrollBenefit: (uuid) => `${B}/plans/${uuid}/enroll`,
};

export const API_BASE = () => import.meta.env.VITE_API_BASE || '/api';
export const newKey = () => globalThis.crypto.randomUUID();
/** Header for create calls that take an Idempotency-Key. */
export const idem = (key = newKey()) => ({ 'Idempotency-Key': key });

const OPS = 'payroll.configure|payroll.view|payroll.run|payroll.results.view|payroll.compensation.view';
const SETUP = 'payroll.configure|payroll.compensation.manage|payroll.view';
/** Section navigation. `permission` is an any-of list; the nav shows only what the user may open. */
export const NAV = [
  { to: '/payroll/overview', label: 'Command center', permission: OPS },
  { to: '/payroll/readiness', label: 'Readiness', permission: OPS },
  { to: '/payroll/my/payslips', label: 'My payslips', permission: 'payroll.payslips.view_own' },
  { to: '/payroll/my/compensation', label: 'My compensation', permission: 'payroll.compensation.view_own' },
  { to: '/payroll/my/loans', label: 'Loans & advances', permission: 'payroll.loans.view_own' },
  { to: '/payroll/my/benefits', label: 'My benefits', permission: 'payroll.benefits.view_own|payroll.benefits.enroll_own' },
  { to: '/payroll/benefits', label: 'Benefits admin', permission: 'payroll.benefits.manage' },
  { to: '/payroll/my/tax', label: 'Tax declaration', permission: 'payroll.tax_declaration.submit' },
  { to: '/payroll/groups', label: 'Pay groups', permission: SETUP },
  { to: '/payroll/periods', label: 'Periods', permission: SETUP },
  { to: '/payroll/compensation', label: 'Compensation', permission: 'payroll.compensation.view|payroll.compensation.manage|payroll.compensation.approve' },
  { to: '/payroll/components', label: 'Components', permission: SETUP },
  { to: '/payroll/structures', label: 'Structures', permission: SETUP },
  { to: '/payroll/country-packs', label: 'Country packs', permission: 'payroll.configure|payroll.country_pack.manage|payroll.country_pack.publish' },
  { to: '/payroll/runs', label: 'Payroll runs', permission: 'payroll.view|payroll.run' },
  { to: '/payroll/payments', label: 'Payments', permission: 'payroll.payments.prepare|payroll.payments.approve|payroll.payments.confirm' },
  { to: '/payroll/accounting', label: 'Accounting', permission: 'payroll.accounting.manage|payroll.accounting.export' },
  { to: '/payroll/reports', label: 'Reports', permission: 'payroll.reports.view|payroll.export' },
  { to: '/payroll/settlement', label: 'Settlement', permission: 'payroll.settlement.manage|payroll.settlement.approve' },
];
/** Anyone with at least one payroll permission may open the module; each section gates itself. */
export const PAYROLL_ACCESS = [...new Set(NAV.flatMap((n) => n.permission.split('|')))].join('|');
