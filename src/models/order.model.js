const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');

class Order extends Model {}

Order.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  buyer_id: { type: DataTypes.INTEGER, allowNull: false },
  address_id: { type: DataTypes.INTEGER, allowNull: false },
  order_number: { type: DataTypes.STRING(20), allowNull: false, unique: true },
  subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  shipping_total: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  status: { type: DataTypes.STRING(20), defaultValue: 'pending_payment' },
  active: { type: DataTypes.BOOLEAN, defaultValue: true },
  created_at: { type: DataTypes.DATE, allowNull: true },
  updated_at: { type: DataTypes.DATE, allowNull: true },
}, {
  sequelize, modelName: 'Order', tableName: 'orders', timestamps: false,
});

Order.associate = (models) => {
  Order.belongsTo(models.User, { foreignKey: 'buyer_id', as: 'buyer' });
  Order.belongsTo(models.Address, { foreignKey: 'address_id', as: 'shipping_address' });
  Order.hasMany(models.ShopOrder, { foreignKey: 'order_id', as: 'shop_orders' });
};

module.exports = Order;