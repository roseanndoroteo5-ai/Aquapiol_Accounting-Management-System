import { Sequelize } from "sequelize";
import inquirer from "inquirer";
import { sequelize } from "./models/Accounting.js";

const dbName = process.env.DB_NAME || "aquapiol_accounting_db";
const dbUser = process.env.DB_USER || "root";
const dbPassword = process.env.DB_PASSWORD || "";
const dbHost = process.env.DB_HOST || "localhost";
const rootSequelize = new Sequelize(`mysql://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPassword)}@${dbHost}:3306/`, { logging: false });

try {
  await rootSequelize.query(`CREATE DATABASE IF NOT EXISTS \`${dbName.replace(/`/g, "") }\`;`);
  console.log(`✅ Database '${dbName}' is ready.`);
  await sequelize.authenticate();
  // IMPORTANT: no force:true; existing records are never dropped by this migration.
  await sequelize.sync();
  const userColumns = await sequelize.getQueryInterface().describeTable("Users");
  if (!userColumns.isActive) {
    const { DataTypes } = await import("sequelize");
    await sequelize.getQueryInterface().addColumn("Users", "isActive", { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true });
  }
  console.log("✅ Missing accounting tables created. Existing tables/data were not force-dropped.");
} catch (error) {
  console.error("❌ Migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await rootSequelize.close();
  await sequelize.close();
}
