const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');

class Product extends Model {}

Product.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  shop_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  category_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  brand_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  name: DataTypes.STRING(255),
  description: { 
    type: DataTypes.TEXT,
    allowNull: true,
  },
 price: {
  type: DataTypes.DECIMAL(12, 2),
  allowNull: false,
},
previous_price: {
  type: DataTypes.DECIMAL(12, 2),
  allowNull: true,
},
  gender: DataTypes.STRING(255),
  condition: {
    type: DataTypes.STRING(255),
    defaultValue: 'new',
  },
  badge: DataTypes.STRING(255),
  sold_count: {
  type: DataTypes.INTEGER,
  defaultValue: 0,
},
rating_average: {
  type: DataTypes.DECIMAL(3, 2),
  defaultValue: 0,
},
rating_count: {
  type: DataTypes.INTEGER,
  defaultValue: 0,
},
  featured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
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
  modelName: 'Product',
  tableName: 'products',
  timestamps: false,
});

Product.associate = (models) => {
  Product.belongsTo(models.Shop, {
    foreignKey: 'shop_id',
    as: 'shop',
  });

  Product.hasMany(models.ProductImage, {
    foreignKey: 'product_id',
    as: 'images',
  });

  Product.hasMany(models.ProductVariant, {
    foreignKey: 'product_id',
    as: 'variants',
  });

  Product.belongsTo(models.Category, {
    foreignKey: 'category_id',
    as: 'category',
  });

  Product.belongsTo(models.Brand, {
    foreignKey: 'brand_id',
    as: 'brand',
  });
};

module.exports = Product;