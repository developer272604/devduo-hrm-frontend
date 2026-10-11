import { Route } from 'react-router-dom';
import { Package, Receipt, Plane } from 'lucide-react';
import { AssetsPage, AssetDetailPage, ExpensesPage, ExpensePoliciesPage, ExpenseDetailPage, TravelPage, TravelDetailPage } from '../pages/operations/OperationsPages';
import { operationPermissions } from '../lib/operationsApi';
export const operationsRoutes = <>
  <Route path="assets" element={<AssetsPage />} /><Route path="assets/:uuid" element={<AssetDetailPage />} />
  <Route path="expenses" element={<ExpensesPage />} /><Route path="expenses/policies" element={<ExpensePoliciesPage />} /><Route path="expenses/:uuid" element={<ExpenseDetailPage />} />
  <Route path="travel" element={<TravelPage />} /><Route path="travel/:uuid" element={<TravelDetailPage />} />
</>;
export const operationsNavItems = [
  { to: '/assets', label: 'Assets', icon: Package, permission: operationPermissions.assets, module: 'assets' },
  { to: '/expenses', label: 'Expenses', icon: Receipt, permission: operationPermissions.expenses, module: 'expenses' },
  { to: '/travel', label: 'Travel', icon: Plane, permission: operationPermissions.travel, module: 'travel' },
];
