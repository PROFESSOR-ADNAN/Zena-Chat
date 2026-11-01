import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const verifyTokenAndGetUser = async (token) => {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.isSuspended) return null;
    return user;
  } catch (err) {
    return null;
  }
};

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  const user = await verifyTokenAndGetUser(token);
  if (!user) {
    return res.status(401).json({ message: 'Not authorized' });
  }

  req.user = user;
  next();
};

export const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Forbidden: Admin access required' });
};
