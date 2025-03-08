const Report = require('../models/Report');

/**
 * POST /api/moderation/report/:userId
 * Body: { reason, details }
 */
exports.reportUser = async (req, res) => {
  try {
    const report = await Report.create({
      reportedUser: req.params.userId,
      reporter: req.user.id,
      reason: req.body.reason,
      details: req.body.details
    });
    res.status(201).json(report);
  } catch (error) {
    console.error('reportUser Error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/moderation/reports
 * Return all reports. In real usage, you'd add filtering or pagination.
 */
exports.getReports = async (req, res) => {
  try {
    const reports = await Report.find()
      .populate('reportedUser', 'username')
      .populate('reporter', 'username');
    res.json(reports);
  } catch (error) {
    console.error('getReports Error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * PATCH /api/moderation/reports/:reportId/resolve
 * Body: { action } to define the resolution
 */
exports.resolveReport = async (req, res) => {
  try {
    const report = await Report.findByIdAndUpdate(
      req.params.reportId,
      { action: req.body.action, resolved: true },
      { new: true }
    );
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    res.json(report);
  } catch (error) {
    console.error('resolveReport Error:', error);
    res.status(500).json({ message: error.message });
  }
};
