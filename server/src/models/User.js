// server/src/models/User.js

const { DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');
const sequelize = require('../database');

const SALT_ROUNDS = process.env.BCRYPT_SALT_ROUNDS
  ? parseInt(process.env.BCRYPT_SALT_ROUNDS)
  : 10;

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    validate: {
      isEmail: { msg: 'Must be a valid email address' },
      notNull: { msg: 'Email is required' }
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notNull: { msg: 'Password is required' }
    }
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notNull: { msg: 'First name is required' },
      notEmpty: { msg: 'First name cannot be empty' }
    }
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  nickname: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notNull: { msg: 'Nickname is required' },
      notEmpty: { msg: 'Nickname cannot be empty' }
    }
  },
  birthDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    validate: {
      notNull: { msg: 'Birth date is required' },
      isDate: { msg: 'Birth date must be a valid date' }
    }
  },
  gender: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notNull: { msg: 'Gender is required' },
      notEmpty: { msg: 'Gender cannot be empty' }
    }
  },
  lookingFor: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: true
  },
  role: {
    type: DataTypes.ENUM('user', 'admin'),
    defaultValue: 'user'
  },
  accountStatus: {
    type: DataTypes.ENUM('active', 'banned'),
    defaultValue: 'active'
  },
  lastActive: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Avatar field to store the user's image URL
  avatar: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isUrl: { msg: 'Avatar must be a valid URL' }
    }
  }
}, {
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(SALT_ROUNDS);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(SALT_ROUNDS);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  },
  defaultScope: {
    // Exclude sensitive fields by default
    attributes: { exclude: ['password'] }
  },
  scopes: {
    // Include the password field when needed (e.g., for authentication)
    withPassword: {
      attributes: { }
    }
  }
});

// Instance method to compare password
User.prototype.comparePassword = async function (candidatePassword) {
  // this.password should be available if using the 'withPassword' scope
  return bcrypt.compare(candidatePassword, this.password);
};

// Override toJSON to remove sensitive fields when returning user data
User.prototype.toJSON = function () {
  const values = Object.assign({}, this.get());
  delete values.password;
  return values;
};

module.exports = User;
