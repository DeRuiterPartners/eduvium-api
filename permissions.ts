/**
 * Role-Based Access Control (RBAC) Permission Map
 * Shared between frontend and backend
 */

export type UserRole = 'admin' | 'directeur' | 'medewerker';

export type PageKey = 
  | 'dashboard'
  | 'dashboard_overzicht'
  | 'dashboard_meldingen'
  | 'dashboard_onderhoud'
  | 'dashboard_financieel'
  | 'onderhoud'
  | 'planning'
  | 'financieel'
  | 'documenten'
  | 'contacten'
  | 'meldingen'
  | 'objecten'
  | 'beheer'
  | 'klimaat'
  | 'slimme_analyses'
  | 'gebouwinformatie';

const ROLE_PERMISSIONS: Record<UserRole, PageKey[]> = {
  admin: [
    'dashboard',
    'dashboard_overzicht',
    'dashboard_meldingen',
    'dashboard_onderhoud',
    'dashboard_financieel',
    'onderhoud',
    'planning',
    'financieel',
    'documenten',
    'contacten',
    'meldingen',
    'objecten',
    'beheer',
    'klimaat',
    'slimme_analyses',
    'gebouwinformatie',
  ],
  directeur: [
    'dashboard',
    'dashboard_overzicht',
    'dashboard_meldingen',
    'dashboard_onderhoud',
    'dashboard_financieel',
    'onderhoud',
    'planning',
    'financieel',
    'documenten',
    'contacten',
    'meldingen',
    'objecten',
    'klimaat',
    'slimme_analyses',
    'gebouwinformatie',
  ],
  medewerker: [
    'dashboard',
    'dashboard_overzicht',
    'dashboard_meldingen',
    'dashboard_onderhoud',
    'onderhoud',
    'documenten',
    'contacten',
    'slimme_analyses',
    'gebouwinformatie',
  ],
};

export function hasAccess(role: UserRole | undefined | null, page: PageKey): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(page);
}

export function getAccessiblePages(role: UserRole | undefined | null): PageKey[] {
  if (!role) return [];
  return ROLE_PERMISSIONS[role] || [];
}

export function canAccessBeheer(role: UserRole | undefined | null): boolean {
  return hasAccess(role, 'beheer');
}

export function canAccessFinancieel(role: UserRole | undefined | null): boolean {
  return hasAccess(role, 'financieel');
}

export function canAccessObjecten(role: UserRole | undefined | null): boolean {
  return hasAccess(role, 'objecten');
}

export function getDashboardTabs(role: UserRole | undefined | null): string[] {
  const tabs: string[] = [];
  if (hasAccess(role, 'dashboard_overzicht')) tabs.push('overzicht');
  if (hasAccess(role, 'dashboard_meldingen')) tabs.push('meldingen');
  if (hasAccess(role, 'dashboard_onderhoud')) tabs.push('onderhoud');
  if (hasAccess(role, 'dashboard_financieel')) tabs.push('financieel');
  return tabs;
}
