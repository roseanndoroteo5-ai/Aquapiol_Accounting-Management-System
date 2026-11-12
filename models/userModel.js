import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

// Existing User model retained and extended for the AquaPiol role-based system.
export const User = sequelize.define("User", {
  name: { type: DataTypes.STRING(120), allowNull: false },
  email: { type: DataTypes.STRING(150), allowNull: false, unique: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  role: { type: DataTypes.ENUM("admin", "staff", "visitors"), allowNull: false, defaultValue: "staff" },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, { tableName: "Users", timestamps: true });

export { sequelize };
