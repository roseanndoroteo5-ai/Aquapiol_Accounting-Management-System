import bcrypt from "bcrypt";
import { sequelize, User } from "../models/Accounting.js";

try {
  await sequelize.authenticate();
  await sequelize.sync();
  const userColumns = await sequelize.getQueryInterface().describeTable("Users");
  if (!userColumns.isActive) {
    const { DataTypes } = await import("sequelize");
    await sequelize.getQueryInterface().addColumn("Users", "isActive", { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true });
  }
  const adminCount = await User.count({ where: { role: "admin" } });
  const staffCount = await User.count({ where: { role: "staff" } });
  if (adminCount === 0 || staffCount === 0) {
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@12345";
    const staffPassword = process.env.SEED_STAFF_PASSWORD || "Staff@12345";
    const newUsers = [];
    if (adminCount === 0) newUsers.push({ name: "AquaPiol Administrator", email: "admin@aquapiol.local", password: await bcrypt.hash(adminPassword, 12), role: "admin", isActive: true });
    if (staffCount === 0) newUsers.push({ name: "AquaPiol Staff", email: "staff@aquapiol.local", password: await bcrypt.hash(staffPassword, 12), role: "staff", isActive: true });
    await User.bulkCreate(newUsers);
    console.log("Missing starter role accounts created:");
    if (adminCount === 0) console.log("Admin: admin@aquapiol.local / " + adminPassword);
    if (staffCount === 0) console.log("Staff: staff@aquapiol.local / " + staffPassword);
    console.log("Change these passwords after your first login.");
  } else {
    console.log("Users already exist. No default accounts were added.");
  }
} catch (error) {
  console.error("User seeding failed:", error.message);
  process.exitCode = 1;
} finally { await sequelize.close(); }
