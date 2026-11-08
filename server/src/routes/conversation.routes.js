import { Router } from 'express';
import {
  createDM,
  createGroup,
  listMyConversations,
  getMessages,
  syncConversations,
  deleteConversation,
  editMessageController,
  deleteMessageController,
} from '../controllers/conversation.controller.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/', listMyConversations);
router.get('/sync', syncConversations);
router.post('/dm', createDM);
router.post('/group', createGroup);
router.delete('/:id', deleteConversation);
router.get('/:id/messages', getMessages);
router.patch('/:id/messages/:messageId', editMessageController);
router.delete('/:id/messages/:messageId', deleteMessageController);

export default router;
