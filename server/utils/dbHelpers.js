/**
 * dbHelpers.js — Database helper utilities for common operations
 */
import mongoose from 'mongoose';
import { createNotFoundError } from './errorHandler.js';

/**
 * Execute a paginated query and return results with metadata.
 *
 * @param {import("mongoose").Query} query      Mongoose Query (without skip/limit)
 * @param {object}                 [opts]       Pagination & projection options
 * @param {number|string}          [opts.page=1]    Page number (1‑indexed)
 * @param {number|string}          [opts.limit=20]  Items per page
 * @param {string|object}          [opts.sort='-createdAt']   Sort spec
 * @param {string}                 [opts.select]  Space-separated list of fields to include/exclude
 * @param {Array|string}           [opts.populate] Paths to populate
 * @returns {Promise<object>}       { data, pagination: { total, page, pages, limit, hasMore } }
 */
export async function getPaginatedResults(query, opts = {}) {
  const page  = Math.max(1, parseInt(opts.page, 10) || 1);
  const limit = Math.max(1, parseInt(opts.limit, 10) || 20);
  const skip  = (page - 1) * limit;

  // Apply projection & population if given
  if (opts.select) {
    query = query.select(opts.select);
  }
  if (opts.populate) {
    if (Array.isArray(opts.populate)) {
      opts.populate.forEach(path => { query = query.populate(path); });
    } else {
      query = query.populate(opts.populate);
    }
  }

  // Clone filter for counting without skip/limit
  const model = query.model;
  const filter = query.getFilter();
  const countPromise = model.countDocuments(filter).exec();

  // Apply pagination and sort, then execute
  const docsPromise = query
    .sort(opts.sort || '-createdAt')
    .skip(skip)
    .limit(limit)
    .lean()
    .exec();

  const [data, total] = await Promise.all([docsPromise, countPromise]);
  const pages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      total,
      page,
      pages,
      limit,
      hasMore: page < pages
    }
  };
}

/**
 * Find a document by ID, applying select/populate/lean, or throw 404.
 *
 * @param {import("mongoose").Model} model    Mongoose model
 * @param {string|import("mongoose").Types.ObjectId} id
 * @param {object}                   [opts]
 * @param {string}                   [opts.select]   projection
 * @param {Array|string}             [opts.populate] populate paths
 * @param {boolean}                  [opts.lean=false]
 * @returns {Promise<object>}
 * @throws If ID invalid or no document found
 */
export async function findByIdOrThrow(model, id, opts = {}) {
  if (!mongoose.isValidObjectId(id)) {
    throw createNotFoundError(`${model.modelName} not found`);
  }

  let query = model.findById(id);
  if (opts.select) query = query.select(opts.select);
  if (opts.populate) {
    if (Array.isArray(opts.populate)) {
      opts.populate.forEach(path => { query = query.populate(path); });
    } else {
      query = query.populate(opts.populate);
    }
  }
  if (opts.lean) query = query.lean();

  const doc = await query.exec();
  if (!doc) {
    throw createNotFoundError(`${model.modelName} not found`);
  }
  return doc;
}

/**
 * Strip sensitive user settings according to privacy preferences.
 *
 * @param {object|Array<object>} userData
 * @returns {object|Array<object>|null}
 */
export function applyPrivacySettings(userData) {
  const sanitize = (u) => {
    if (!u) return null;
    const obj = typeof u.toObject === 'function' ? u.toObject() : { ...u };

    const privacy = obj.settings?.privacy;
    if (privacy?.showOnlineStatus === false) {
      obj.isOnline = false;
    }
    if (privacy?.showReadReceipts === false) {
      delete obj.lastRead;
    }
    if (privacy?.showLastSeen === false) {
      delete obj.lastActive;
    }

    delete obj.settings;
    return obj;
  };

  if (Array.isArray(userData)) {
    return userData.map(sanitize).filter(Boolean);
  }
  return sanitize(userData);
}

/**
 * Build standardized query options from Express request query.
 *
 * @param {object} reqQuery — req.query
 * @returns {object} { page, limit, sort, select, populate, lean }
 */
export function createQueryOptions(reqQuery = {}) {
  const opts = {
    page:  Number.parseInt(reqQuery.page, 10)  || 1,
    limit: Number.parseInt(reqQuery.limit, 10) || 20,
    sort:  reqQuery.sort || '-createdAt',
    select: reqQuery.select || undefined,
    lean: reqQuery.lean !== 'false'
  };

  if (reqQuery.populate) {
    try {
      opts.populate = JSON.parse(reqQuery.populate);
    } catch {
      opts.populate = reqQuery.populate.split(',').map(s => s.trim());
    }
  }

  return opts;
}

/**
 * Create a MongoDB filter object from request query, optionally whitelisting fields.
 *
 * @param {object} reqQuery       — req.query
 * @param {string[]} allowed     — array of allowed filter keys
 * @returns {object} MongoDB filter
 */
export function createFilterObject(reqQuery = {}, allowed = []) {
  // Clone and remove pagination/sorting params
  const filter = { ...reqQuery };
  ['page', 'limit', 'sort', 'select', 'populate', 'lean'].forEach(f => delete filter[f]);

  // Whitelist fields if provided
  if (allowed.length) {
    Object.keys(filter).forEach(key => {
      if (!allowed.includes(key)) delete filter[key];
    });
  }

  // Support range operators: gt, gte, lt, lte
  let str = JSON.stringify(filter);
  str = str.replace(/\b(gt|gte|lt|lte)\b/g, m => `$${m}`);
  return JSON.parse(str);
}
