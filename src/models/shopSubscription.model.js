
const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');

class ShopSubscription extends Model {}

ShopSubscription.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  shop_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  plan_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  starts_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  ends_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING(150),
    defaultValue: 'active',
  },
  price_paid: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00,
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
  modelName: 'ShopSubscription',
  tableName: 'shop_subscriptions',
  timestamps: false,
});

ShopSubscription.associate = (models) => {
  ShopSubscription.belongsTo(models.Plan, {
    foreignKey: 'plan_id',
    as: 'plan',
  });
  ShopSubscription.belongsTo(models.Shop, {
    foreignKey: 'shop_id',
    as: 'shop',
  });
};

module.exports = ShopSubscription;