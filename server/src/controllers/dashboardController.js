import { getDashboardAnalytics } from '../services/analytics/analyticsService.js';

export async function getDashboardSummary(req, res, next) {
  try {
    const summary = await getDashboardAnalytics();
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
}
