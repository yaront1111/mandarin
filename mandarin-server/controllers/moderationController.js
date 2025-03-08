// controllers/moderationController.js
const Report = require('../models/Report');

exports.reportUser = async (req, res) => {
  try {
    // Create a report document
    const report = await Report.create({
      reportedUser: req.params.userId,
      reporter: req.user.id, // assuming auth middleware
      reason: req.body.reason,
      details: req.body.details,
    });
    res.status(201).json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getReports = async (req, res) => {
  try {
    const reports = await Report.find();
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.resolveReport = async (req, res) => {
  try {
    // Dummy implementation: mark report as resolved with given action
    const report = await Report.findByIdAndUpdate(
      req.params.reportId,
      { action: req.body.action, resolved: true },
      { new: true }
    );
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
