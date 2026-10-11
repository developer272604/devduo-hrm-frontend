export { listOf, pageOf, send, unwrap, useList } from './timeOfficeApi';

export const L = '/v1/learning';
export const learningPaths = {
  courses: `${L}/courses`,
  course: (uuid, part = '') => `${L}/courses/${uuid}${part ? `/${part}` : ''}`,
  my: `${L}/my`,
  paths: `${L}/paths`,
  skills: `${L}/skills`,
  levels: `${L}/skill-levels`,
  mySkills: `${L}/my/skills`,
};
export const LEARNING_ACCESS = 'learning.self|learning.view|learning.catalog.manage|learning.skills.manage';
