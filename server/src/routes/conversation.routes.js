import { Router } from 'express';
import {
  createDM,
  createGroup,
  listMyConversations,
  getMessages,
  syncConversations,
} from '../controllers/conversation.controller.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/', listMyConversations);
router.get('/sync', syncConversations);
router.post('/dm', createDM);
router.post('/group', createGroup);
router.get('/:id/messages', getMessages);

export default router;
