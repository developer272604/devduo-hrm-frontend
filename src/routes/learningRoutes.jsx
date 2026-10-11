import { Route } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import Access from '../components/Access';
import LearningLayout, { LearningHome } from '../pages/learning/LearningLayout';
import { CatalogPage, MyLearningPage, MySkillsPage, PathsPage } from '../pages/learning/LearningPages';
import { LEARNING_ACCESS } from '../lib/learningApi';

export const learningRoutes = <Route path="learning" element={<Access permission={LEARNING_ACCESS} module="learning"><LearningLayout /></Access>}>
  <Route index element={<LearningHome />} />
  <Route path="catalog" element={<CatalogPage />} />
  <Route path="my" element={<MyLearningPage />} />
  <Route path="paths" element={<PathsPage />} />
  <Route path="skills" element={<MySkillsPage />} />
</Route>;

export const learningNavItem = { to: '/learning', label: 'Learning', icon: BookOpen, permission: LEARNING_ACCESS, module: 'learning' };
export const NAV = [
  { to: '/learning/catalog', label: 'Course catalog', permission: 'learning.self|learning.view|learning.catalog.manage' },
  { to: '/learning/my', label: 'My learning', permission: 'learning.self' },
  { to: '/learning/paths', label: 'Learning paths', permission: 'learning.self|learning.view|learning.catalog.manage' },
  { to: '/learning/skills', label: 'My skills', permission: 'learning.self' },
];
