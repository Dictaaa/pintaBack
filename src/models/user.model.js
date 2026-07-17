// src/models/user.model.js
const { DataTypes, Model } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/db');

class User extends Model {
  async comparePassword(candidate) {
    return bcrypt.compare(candidate, this.password);
  }
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    role_id: DataTypes.INTEGER,
    first_name: DataTypes.STRING(100),
    middle_name: DataTypes.STRING(100),
    last_name: DataTypes.STRING(100),
    second_last_name: DataTypes.STRING(100),
    email: DataTypes.STRING(255),
    password: DataTypes.STRING(255),
    phone: DataTypes.STRING(20),
    document_type: DataTypes.STRING(50),
    document_number: DataTypes.STRING(50),
    email_verified_at: DataTypes.INTEGER,
    last_login_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    }
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: false,
    hooks: {
      beforeCreate: async (user) => {
        user.password = await bcrypt.hash(user.password, 12);
      },
      beforeUpdate: async (user) => {
        if (user.changed('password'))
          user.password = await bcrypt.hash(user.password, 12);
      },
    },
    defaultScope: { attributes: { exclude: ['password'] } },
    scopes: { withPassword: {} },
  }
);

User.associate = (models) => {
  User.belongsTo(models.Role, { foreignKey: 'role_id', as: 'role' });
  User.hasMany(models.Shop, { foreignKey: 'owner_id', as: 'shops' });
};

module.exports = User;
