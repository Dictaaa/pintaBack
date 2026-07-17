const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');

class ProductImage extends Model {}

ProductImage.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  url: DataTypes.TEXT,
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
  modelName: 'ProductImage',
  tableName: 'product_images',
  timestamps: false,
});

ProductImage.associate = (models) => {
  ProductImage.belongsTo(models.Product, {
    foreignKey: 'product_id',
    as: 'product',
  });
};

module.exports = ProductImage;