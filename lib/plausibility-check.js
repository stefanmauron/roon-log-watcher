'use strict';

// Memory plausibility helper used as the central definition for the dashboard concept.
// Formula: Managed + Unmanaged - Physical.
// Interpretation: small differences are normal because Roon/runtime counters and OS memory
// counters do not measure exactly the same thing at exactly the same moment.
function evaluateMemoryPlausibility({ managed = 0, unmanaged = 0, physical = 0 } = {}) {
  const relation = Number(managed || 0) + Number(unmanaged || 0) - Number(physical || 0);
  const abs = Math.abs(relation);
  const status = abs < 100 ? 'consistent' : abs < 250 ? 'review' : 'mismatch';
  return { relationMB: relation, absRelationMB: abs, status };
}

module.exports = { evaluateMemoryPlausibility };
