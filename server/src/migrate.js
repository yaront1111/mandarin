// server/src/migrate.js
const { Umzug, SequelizeStorage } = require('umzug');
const { sequelize } = require('./models');
const { Sequelize } = require('sequelize'); // Import Sequelize

const runMigrations = async () => {
  const umzug = new Umzug({
    migrations: {
      glob: 'migrations/*.js',
      resolve: ({ name, path, context }) => {
        // Load the migration file.
        const migration = require(path);
        return {
          name,
          up: async () => migration.up(context.queryInterface, context.Sequelize),
          down: async () => migration.down(context.queryInterface, context.Sequelize),
        };
      },
    },
    context: {
      queryInterface: sequelize.getQueryInterface(),
      Sequelize // Pass Sequelize so migration files can use it
    },
    storage: new SequelizeStorage({ sequelize }),
    logger: console,
  });

  console.log('Running pending migrations...');
  await umzug.up();
  console.log('Migrations complete.');
};

module.exports = runMigrations;
