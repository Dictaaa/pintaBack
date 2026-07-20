const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');

class OrderItem extends Model {}

OrderItem.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  shop_order_id: { type: DataTypes.INTEGER, allowNull: false },
  product_id: { type: DataTypes.INTEGER, allowNull: false },
  variant_id: { type: DataTypes.INTEGER, allowNull: true },
  product_name: { type: DataTypes.STRING(150), allowNull: false },
  size_name: { type: DataTypes.STRING(20), allowNull: true },
  color_name: { type: DataTypes.STRING(50), allowNull: true },
  unit_price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  active: { type: DataTypes.BOOLEAN, defaultValue: true },
  created_at: { type: DataTypes.DATE, allowNull: true },
  updated_at: { type: DataTypes.DATE, allowNull: true },
}, {
  sequelize, modelName: 'OrderItem', tableName: 'order_items', timestamps: false,
});

OrderItem.associate = (models) => {
  OrderItem.belongsTo(models.ShopOrder, { foreignKey: 'shop_order_id', as: 'shop_order' });
  OrderItem.belongsTo(models.Product, { foreignKey: 'product_id', as: 'product' });
  OrderItem.belongsTo(models.ProductVariant, { foreignKey: 'variant_id', as: 'variant' });
};

module.exports = OrderItem;