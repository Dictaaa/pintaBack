const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');

class ShopOrder extends Model {}

ShopOrder.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  order_id: { type: DataTypes.INTEGER, allowNull: false },
  shop_id: { type: DataTypes.INTEGER, allowNull: false },
  subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  shipping_cost: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  commission_amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  status: { type: DataTypes.STRING(20), defaultValue: 'pending' },
  tracking_number: { type: DataTypes.STRING(100), allowNull: true },
  shipped_at: { type: DataTypes.DATE, allowNull: true },
  delivered_at: { type: DataTypes.DATE, allowNull: true },
  active: { type: DataTypes.BOOLEAN, defaultValue: true },
  created_at: { type: DataTypes.DATE, allowNull: true },
  updated_at: { type: DataTypes.DATE, allowNull: true },
}, {
  sequelize, modelName: 'ShopOrder', tableName: 'shop_orders', timestamps: false,
});

ShopOrder.associate = (models) => {
  ShopOrder.belongsTo(models.Order, { foreignKey: 'order_id', as: 'order' });
  ShopOrder.belongsTo(models.Shop, { foreignKey: 'shop_id', as: 'shop' });
  ShopOrder.hasMany(models.OrderItem, { foreignKey: 'shop_order_id', as: 'items' });
};

module.exports = ShopOrder;