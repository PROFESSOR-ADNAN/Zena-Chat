import crypto from 'crypto';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import Conversation from '../models/Conversation.js';
import Membership from '../models/Membership.js';
import { generateToken } from '../utils/generateToken.js';
import { redis } from '../config/redis.js';

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export const ensureUserInGeneralChat = async (userId) => {
  try {
    let generalRoom = await Conversation.findOne({ name: 'General Chat', type: 'group' });
    if (!generalRoom) {
      generalRoom = await Conversation.create({
        type: 'group',
        name: 'General Chat',
        participants: [userId],
        createdBy: userId,
        lastSeq: 0,
        lastEventSeq: 0,
      });
    } else if (!generalRoom.participants.some((p) => p.toString() === userId.toString())) {
      generalRoom.participants.push(userId);
      await generalRoom.save();
    }

    await Membership.findOneAndUpdate(
      { conversationId: generalRoom._id, userId },
      {
        $setOnInsert: {
          conversationId: generalRoom._id,
          userId,
          role: 'member',
          lastDeliveredSeq: 0,
          lastReadSeq: 0,
        },
      },
      { upsert: true }
    );
  } catch (err) {
    console.warn('ensureUserInGeneralChat warning:', err.message);
  }
};

export const register = async (req, res, next) => {
  try {
    const { username, displayName, name, email, password } = req.body;
    const finalDisplayName = displayName || name;
    const finalUsername = (username || (email ? email.split('@')[0] : '')).toLowerCase();

    if (!finalDisplayName || !email || !password) {
      return res.status(400).json({ message: 'displayName, email, and password are required' });
    }

    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const usernameExists = await User.findOne({ username: finalUsername });
    if (usernameExists) {
      return res.status(409).json({ message: 'Username already taken' });
    }

    const user = await User.create({
      username: finalUsername,
      displayName: finalDisplayName,
      name: finalDisplayName,
      email,
      password,
    });

    const accessToken = generateToken(user._id);

    // Create initial refresh token
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const familyId = crypto.randomUUID();
    await RefreshToken.create({
      userId: user._id,
      tokenHash: hashToken(rawRefreshToken),
      familyId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    await ensureUserInGeneralChat(user._id);

    res.cookie('refreshToken', rawRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      _id: user._id,
      username: user.username,
      displayName: user.displayName,
      name: user.displayName,
      email: user.email,
      role: user.role,
      token: accessToken,
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { login, email, password } = req.body;
    const identifier = login || email;

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = await User.findOne({
      $or: [{ email: identifier.toLowerCase() }, { username: identifier.toLowerCase() }],
    }).select('+password');

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (user.isSuspended) {
      return res.status(403).json({ message: 'Account is suspended' });
    }

    const accessToken = generateToken(user._id);

    // Refresh token family
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const familyId = crypto.randomUUID();
    await RefreshToken.create({
      userId: user._id,
      tokenHash: hashToken(rawRefreshToken),
      familyId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    await ensureUserInGeneralChat(user._id);

    res.cookie('refreshToken', rawRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      _id: user._id,
      username: user.username,
      displayName: user.displayName,
      name: user.displayName,
      email: user.email,
      role: user.role,
      token: accessToken,
    });
  } catch (err) {
    next(err);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const rawToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!rawToken) {
      return res.status(401).json({ message: 'Refresh token required' });
    }

    const hashed = hashToken(rawToken);
    const stored = await RefreshToken.findOne({ tokenHash: hashed });

    if (!stored) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    if (stored.isRevoked || stored.expiresAt < new Date()) {
      // Reuse of revoked token triggers family revocation
      await RefreshToken.updateMany({ familyId: stored.familyId }, { isRevoked: true });
      return res.status(401).json({ message: 'Compromised refresh token. All sessions revoked' });
    }

    // Invalidate old token
    stored.isRevoked = true;
    await stored.save();

    // Rotate to new token in the same family
    const newRawToken = crypto.randomBytes(40).toString('hex');
    await RefreshToken.create({
      userId: stored.userId,
      tokenHash: hashToken(newRawToken),
      familyId: stored.familyId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const newAccessToken = generateToken(stored.userId);

    res.cookie('refreshToken', newRawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ token: newAccessToken });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req, res, next) => {
  try {
    const rawToken = req.cookies?.refreshToken;
    if (rawToken) {
      await RefreshToken.deleteOne({ tokenHash: hashToken(rawToken) });
    }
    res.clearCookie('refreshToken');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (err) {
    next(err);
  }
};

export const searchUsers = async (req, res, next) => {
  try {
    const q = req.query.q || '';
    const query = q
      ? {
          $and: [
            { _id: { $ne: req.user._id } },
            {
              $or: [
                { username: { $regex: q, $options: 'i' } },
                { displayName: { $regex: q, $options: 'i' } },
              ],
            },
          ],
        }
      : { _id: { $ne: req.user._id } };

    const users = await User.find(query)
      .select('username displayName avatarUrl isOnline')
      .limit(20);

    res.json(users);
  } catch (err) {
    next(err);
  }
};

export const suspendUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findByIdAndUpdate(userId, { isSuspended: true }, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Revoke all refresh tokens
    await RefreshToken.updateMany({ userId }, { isRevoked: true });

    // Publish to Redis control channel to disconnect sockets across ALL gateway replicas
    await redis.publish('auth:control', JSON.stringify({ action: 'disconnect', userId }));

    res.json({ ok: true, message: `User ${user.username} suspended and disconnected across nodes` });
  } catch (err) {
    next(err);
  }
};
