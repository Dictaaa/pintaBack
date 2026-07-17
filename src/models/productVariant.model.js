const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');

class ProductVariant extends Model {}

ProductVariant.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  size_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  color_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  stock: {
    type: DataTypes.SMALLINT,
    defaultValue: 0,
  },
  sku: {
    type: DataTypes.STRING(100),
    allowNull: false,
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
  modelName: 'ProductVariant',
  tableName: 'product_variants',
  timestamps: false,
});

ProductVariant.associate = (models) => {
  ProductVariant.belongsTo(models.Product, { foreignKey: 'product_id', as: 'product' });
  ProductVariant.belongsTo(models.Size, { foreignKey: 'size_id', as: 'size' });
  ProductVariant.belongsTo(models.Color, { foreignKey: 'color_id', as: 'color' });
};

module.exports = ProductVariant;