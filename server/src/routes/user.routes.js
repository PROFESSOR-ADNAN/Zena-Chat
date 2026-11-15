import { Router } from 'express';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

// GET current user profile
router.get('/profile', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// PUT update current user profile
router.put('/profile', async (req, res, next) => {
  try {
    const { displayName, bio, statusText, avatarUrl } = req.body;
    const user = await User.findById(req.user._id);

    if (displayName && displayName.trim()) user.displayName = displayName.trim();
    if (bio !== undefined) user.bio = bio.trim();
    if (statusText !== undefined) user.statusText = statusText.trim();
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;

    await user.save();
    res.json({
      _id: user._id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      bio: user.bio,
      statusText: user.statusText,
      avatarUrl: user.avatarUrl,
      role: user.role,
    });
  } catch (err) {
    next(err);
  }
});

// POST block user
router.post('/block/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (id === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot block yourself' });
    }

    const user = await User.findById(req.user._id);
    if (!user.blockedUsers) user.blockedUsers = [];

    if (!user.blockedUsers.some((b) => b.toString() === id)) {
      user.blockedUsers.push(id);
      await user.save();
    }

    res.json({ ok: true, blockedUserId: id });
  } catch (err) {
    next(err);
  }
});

// POST unblock user
router.post('/unblock/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(req.user._id);
    if (user.blockedUsers) {
      user.blockedUsers = user.blockedUsers.filter((b) => b.toString() !== id);
      await user.save();
    }
    res.json({ ok: true, unblockedUserId: id });
  } catch (err) {
    next(err);
  }
});

// GET another user's public profile
router.get('/:id/profile', async (req, res, next) => {
  try {
    const target = await User.findById(req.params.id).select(
      'username displayName bio statusText avatarUrl lastSeenAt createdAt'
    );
    if (!target) return res.status(404).json({ message: 'User not found' });
    res.json(target);
  } catch (err) {
    next(err);
  }
});

export default router;
