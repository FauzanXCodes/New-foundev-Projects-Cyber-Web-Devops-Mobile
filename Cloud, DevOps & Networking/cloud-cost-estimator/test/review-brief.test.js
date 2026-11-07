import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildReviewBrief } from '../src/review-brief.js';
import { createDefaultWorkload } from '../src/state.js';

describe('buildReviewBrief', () => {
  it('keeps the estimate, forecast, and review context together', () => {
    const workload = createDefaultWorkload();
    workload.metadata = { owner: 'Platform team', costCenter: 'FIN-042', notes: 'Confirm before launch.' };
    workload.planning = { horizonMonths: 3, monthlyGrowthPercent: 10, contingencyPercent: 0, rateVariancePercent: 0 };
    const brief = buildReviewBrief(workload, '  Launch plan  ');

    assert.match(brief, /^Launch plan — Cloud Cost Calculator review brief/m);
    assert.match(brief, /Sample pricing for learning; not a live or official AWS quote\./);
    assert.match(brief, /Forecast: 3 months at 10% monthly change; grows to \$12\.09\/mo\./);
    assert.match(brief, /Owner: Platform team/);
    assert.match(brief, /Cost centre: FIN-042/);
    assert.match(brief, /Review note: Confirm before launch\./);
  });

  it('keeps missing context and budget evidence explicit', () => {
    const workload = createDefaultWorkload();
    workload.budget = 0;
    const brief = buildReviewBrief(workload);

    assert.match(brief, /Monthly budget: Not set/);
    assert.match(brief, /Decision readiness: 0 ready, 5 need attention\./);
    assert.doesNotMatch(brief, /Owner:/);
  });
});
