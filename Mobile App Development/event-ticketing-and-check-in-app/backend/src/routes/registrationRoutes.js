import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/roles.js';
import { registrationRateLimiter } from '../middleware/rateLimiters.js';
import { registerForEvent, myRegistrations, participantsForEvent, checkInParticipant, exportParticipantsCsv, checkRegistrationStatus, cancelRegistration } from '../controllers/registrationController.js';






const router = Router();

router.post(
  '/:id/register',
  registrationRateLimiter,
  authenticate,
  authorizeRoles('customer', 'organizer', 'admin'),
  registerForEvent
);

router.get('/me', authenticate, myRegistrations);
router.get('/:id/status', authenticate, checkRegistrationStatus);
router.get('/:id/participants', authenticate, authorizeRoles('customer', 'organizer', 'admin'), participantsForEvent);
router.post('/:id/checkin', authenticate, authorizeRoles('customer', 'organizer', 'admin'), checkInParticipant);
router.get('/:id/participants.csv', authenticate, authorizeRoles('customer', 'organizer', 'admin'), exportParticipantsCsv);

// End point to cancel registration
router.delete("/:id/cancel",authenticate,cancelRegistration);
// End point to check refund status
// NOTE: checkRefundStatus handler is not implemented in registrationController.js.
// Left disabled (rather than inventing behaviour) — see mobile-app-refinement-report.md.
// router.get("/:id/refund-status",authenticate,checkRefundStatus);
// End point to check refund policy
// NOTE: checkRefundPolicy handler is not implemented in registrationController.js.
// router.get("/:id/refund-policy",authenticate,checkRefundPolicy)


export default router;
