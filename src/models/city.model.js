const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');

class City extends Model {}

City.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  department: {
    type: DataTypes.STRING(100),
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
  modelName: 'City',
  tableName: 'cities',
  timestamps: false,
});

City.associate = (models) => {
  City.hasMany(models.Shop, {
    foreignKey: 'city_id',
    as: 'shops',
  });
};

module.exports = City;