// src/services/kinkService.js
const { KinkPreference } = require('../models');
const { NotFoundError } = require('../utils/errors');
const { Op } = require('sequelize');

/**
 * Fetch all kink preferences for a user.
 * If you need to ensure they're public, or filter by isPublic, do so here.
 */
async function getUserKinks(userId) {
  // Optionally: where: { userId, isPublic: true } if private preferences exist
  return KinkPreference.findAll({ where: { userId } });
}

/**
 * Calculate how compatible two sets of kink preferences are (0-100).
 */
function calculateKinkCompatibility(user1Kinks, user2Kinks) {
  let compatibilityScore = 0;
  let maxScore = 0;

  // Map of complementary roles
  const complementaryRoles = {
    dominant: 'submissive',
    submissive: 'dominant',
    switch: ['dominant', 'submissive', 'switch'],
    observer: ['dominant', 'submissive', 'switch']
  };

  // Convert array -> object keyed by kinkId
  const user1Map = user1Kinks.reduce((acc, kp) => {
    acc[kp.kinkId] = kp;
    return acc;
  }, {});
  const user2Map = user2Kinks.reduce((acc, kp) => {
    acc[kp.kinkId] = kp;
    return acc;
  }, {});

  // Identify shared kinks
  const sharedKinkIds = Object.keys(user1Map).filter(kinkId => user2Map[kinkId]);

  sharedKinkIds.forEach(kinkId => {
    const pref1 = user1Map[kinkId];
    const pref2 = user2Map[kinkId];

    // We'll have 5 total possible points per kink
    let kinkScore = 0;
    maxScore += 5;

    // 1) Interest level (0–2 points)
    const interestLevels = ['curious', 'interested', 'experienced', 'expert'];
    const idx1 = interestLevels.indexOf(pref1.interestLevel);
    const idx2 = interestLevels.indexOf(pref2.interestLevel);

    if (idx1 >= 2 && idx2 >= 2) {
      // Both experienced
      kinkScore += 2;
    } else if ((idx1 >= 2 && idx2 < 2) || (idx2 >= 2 && idx1 < 2)) {
      // Mentorship potential
      kinkScore += 1.5;
    } else if (idx1 < 2 && idx2 < 2) {
      // Both curious
      kinkScore += 1;
    }

    // 2) Role synergy (0–3 points)
    if (pref1.role && pref2.role) {
      const isComplementary = Array.isArray(complementaryRoles[pref1.role])
        ? complementaryRoles[pref1.role].includes(pref2.role)
        : complementaryRoles[pref1.role] === pref2.role;

      if (isComplementary) {
        kinkScore += 3;
      } else if (pref1.role === pref2.role) {
        kinkScore += 1;
      }
    }

    compatibilityScore += kinkScore;
  });

  if (maxScore === 0) {
    return 0;
  }
  return Math.round((compatibilityScore / maxScore) * 100);
}

/**
 * Public method to get compatibility between two users.
 */
exports.getCompatibilityScore = async (userIdA, userIdB) => {
  if (userIdA === userIdB) return 0; // Same user => no need

  // Fetch kink preferences
  const [user1Kinks, user2Kinks] = await Promise.all([
    getUserKinks(userIdA),
    getUserKinks(userIdB)
  ]);

  return calculateKinkCompatibility(user1Kinks, user2Kinks);
};
