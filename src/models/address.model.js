const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');

class Address extends Model {}

Address.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  city_id: { type: DataTypes.INTEGER, allowNull: false },
  address_line: { type: DataTypes.STRING(255), allowNull: false },
  address_detail: { type: DataTypes.STRING(255), allowNull: true },
  receiver_name: { type: DataTypes.STRING(200), allowNull: false },
  receiver_phone: { type: DataTypes.STRING(20), allowNull: false },
  is_default: { type: DataTypes.BOOLEAN, defaultValue: false },
  active: { type: DataTypes.BOOLEAN, defaultValue: true },
  created_at: { type: DataTypes.DATE, allowNull: true },
  updated_at: { type: DataTypes.DATE, allowNull: true },
}, {
  sequelize,
  modelName: 'Address',
  tableName: 'addresses',
  timestamps: false,
});

Address.associate = (models) => {
  Address.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  Address.belongsTo(models.City, { foreignKey: 'city_id', as: 'city' });
};

module.exports = Address;