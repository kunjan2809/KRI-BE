const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');

// Subscribe Email to Leads (Public API - No authentication required)
// POST /api/leads/subscribe
router.post('/subscribe', leadController.subscribeEmail);

module.exports = router;
