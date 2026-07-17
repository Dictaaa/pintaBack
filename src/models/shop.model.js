const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');

class Shop extends Model {}

Shop.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  owner_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  city_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  slug: {
  type: DataTypes.STRING(60),
  allowNull: false,
  unique: true,
},
  name: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  logo_url: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  banner_url: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  whatsapp: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  instagram: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  facebook: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  tiktok: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  status: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  status_reason: {
    type: DataTypes.STRING(200),
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
  },
}, {
  sequelize,
  modelName: 'Shop',
  tableName: 'shops',
  timestamps: false,
});

Shop.associate = (models) => {
  Shop.hasMany(models.ShopSubscription, {
    foreignKey: 'shop_id',
    as: 'subscriptions',
  });
  Shop.hasMany(models.Product, {
    foreignKey: 'shop_id',
    as: 'products',
  });
  Shop.belongsTo(models.User, {
    foreignKey: 'owner_id',
    as: 'owner',
  });
  Shop.belongsTo(models.City, { foreignKey: 'city_id', as: 'city' });
};

module.exports = Shop;