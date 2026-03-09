const express        = require('express');
const router         = express.Router();
const casemanagement = require('../agents/casemanagement');

router.get('/dashboard', async (req, res) => {
  try {
    const cases = await casemanagement.getAllCases();
    res.json({
      total:    cases.length,
      on_track: cases.filter(c => c.timeline_status === 'On Track').length,
      at_risk:  cases.filter(c => c.timeline_status === 'At Risk').length,
      overdue:  cases.filter(c => c.timeline_status === 'Overdue').length,
      cases:    cases.filter(c => !['Closed', 'Archived'].includes(c.status))
    });
  } catch (e) { res.status(500).json({ status: 'ERROR', message: e.message }); }
});

module.exports = router;
