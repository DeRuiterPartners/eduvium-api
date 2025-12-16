// Analytics SQL query result types
// Used for typing db.execute<Interface>(sql`...`) calls in routes.ts
// Note: Extends Record<string, unknown> to satisfy Drizzle's db.execute constraint

// /api/analytics/available-years
export interface AvailableYearsResult extends Record<string, unknown> {
  year: number;
}

// /api/analytics/maintenance-by-month
export interface MaintenanceByMonthResult extends Record<string, unknown> {
  month: string;   // 'YYYY-MM' format
  count: number;
}

// /api/analytics/reports-by-priority
export interface ReportsByPriorityResult extends Record<string, unknown> {
  priority: string;
  count: number;
}

// /api/analytics/maintenance-status
export interface MaintenanceStatusResult extends Record<string, unknown> {
  status: string;
  count: number;
}

// /api/analytics/budget-overview
export interface BudgetOverviewResult extends Record<string, unknown> {
  category: string;
  budget: number;
  spent: number;
  percentage: number;
}

// /api/analytics/investments-summary
export interface InvestmentsSummaryResult extends Record<string, unknown> {
  category: string;
  total_budgeted: number;
}

// /api/analytics/investments-total
export interface InvestmentsTotalResult extends Record<string, unknown> {
  total_budgeted: number;
  total_count: number;
}

// /api/analytics/reports-by-month
export interface ReportsByMonthResult extends Record<string, unknown> {
  month: string;   // 'YYYY-MM' format
  count: number;
}

// /api/analytics/maintenance-history (if needed in future)
export interface MaintenanceHistoryAnalyticsResult extends Record<string, unknown> {
  category: string;
  count: number;
  total_cost: number; // euros, two decimals
}
