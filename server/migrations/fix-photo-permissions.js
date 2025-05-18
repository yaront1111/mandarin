// MongoDB Migration Script to Fix PhotoPermission Indexes
import mongoose from 'mongoose';
import config from '../config.js';
import logger from '../logger.js';

const fixPhotoPermissions = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.MONGODB_URI);
    logger.info('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('photopermissions');

    // 1. Drop the old conflicting indexes
    logger.info('Dropping old indexes...');
    try {
      await collection.dropIndex('owner_1_viewer_1');
      logger.info('Dropped old owner_1_viewer_1 index');
    } catch (err) {
      if (err.code === 27) {
        logger.info('Index owner_1_viewer_1 does not exist');
      } else {
        throw err;
      }
    }

    // 2. Drop any other legacy indexes that might conflict
    const indexes = await collection.indexes();
    for (const index of indexes) {
      if (index.key.owner || index.key.viewer) {
        logger.info(`Dropping index: ${index.name}`);
        await collection.dropIndex(index.name);
      }
    }

    // 3. Remove the legacy fields from existing documents
    logger.info('Cleaning up legacy fields...');
    await collection.updateMany(
      { $or: [{ owner: { $exists: true } }, { viewer: { $exists: true } }] },
      { $unset: { owner: '', viewer: '' } }
    );

    // 4. Create the correct index
    logger.info('Creating correct index...');
    await collection.createIndex(
      { photo: 1, requestedBy: 1 },
      { unique: true, name: 'photo_requestedBy_unique' }
    );

    // 5. Verify and log the current indexes
    const finalIndexes = await collection.indexes();
    logger.info('Current indexes:');
    finalIndexes.forEach(index => {
      logger.info(`  ${index.name}: ${JSON.stringify(index.key)}`);
    });

    logger.info('Migration completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
};

// Run the migration
fixPhotoPermissions()
  .then(() => {
    logger.info('Photo permissions fix completed');
    process.exit(0);
  })
  .catch(err => {
    logger.error('Photo permissions fix failed:', err);
    process.exit(1);
  });