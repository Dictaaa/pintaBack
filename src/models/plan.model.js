const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');

class Plan extends Model {}

Plan.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(80),
    allowNull: false,
    unique: true,
  },
  description: DataTypes.TEXT,
  monthly_price: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  product_limit: {
    type: DataTypes.SMALLINT,
    allowNull: false,
  },
  images_per_product: {
    type: DataTypes.SMALLINT,
    allowNull: false,
  },
  commission_percentage: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00,
  },
  featured_products_limit: {
    type: DataTypes.SMALLINT,
    defaultValue: 0,
  },
  position: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
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
  },
}, {
  sequelize,
  modelName: 'Plan',
  tableName: 'plans',
  timestamps: false,
});

// plan.model.js
Plan.associate = (models) => {
  Plan.hasMany(models.ShopSubscription, {
    foreignKey: 'plan_id',
    as: 'subscriptions',
  });
};

module.exports = Plan;