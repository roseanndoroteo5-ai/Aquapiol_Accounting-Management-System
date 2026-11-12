/*
    MIT License
    Copyright (c) 2025 Christian I. Cabrera || XianFire Framework
    Mindoro State University - Philippines
*/
import express from "express";
import path from "path";
import session from "express-session";
import flash from "connect-flash";
import router from "./routes/index.js";
import apiRouter from "./routes/api.js";
import fs from "fs";
import hbs from "hbs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname } from "path";
import { sequelize } from "./models/Accounting.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(session({
  name: "aquapiol.sid",
  secret: process.env.SESSION_SECRET || "change-this-aquapiol-session-secret-before-deployment",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 8 * 60 * 60 * 1000 }
}));
app.use(flash());
app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  res.locals.currentUser = req.session.user || null;
  next();
});

app.engine("xian", async (filePath, options, callback) => {
  try {
    const originalPartialsDir = hbs.partialsDir;
    hbs.partialsDir = path.join(__dirname, "views");
    const result = await new Promise((resolve, reject) => {
      hbs.__express(filePath, options, (err, html) => err ? reject(err) : resolve(html));
    });
    hbs.partialsDir = originalPartialsDir;
    callback(null, result);
  } catch (err) { callback(err); }
});
hbs.registerHelper("eq", (a, b) => String(a) === String(b));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "xian");

const partialsDir = path.join(__dirname, "views/partials");
if (fs.existsSync(partialsDir)) {
  for (const file of fs.readdirSync(partialsDir).filter(name => name.endsWith(".xian"))) {
    hbs.registerPartial(file.replace(".xian", ""), fs.readFileSync(path.join(partialsDir, file), "utf8"));
  }
}
app.use("/api/v1/accounting", apiRouter);
app.use("/", router);
app.use((err, req, res, next) => {
  console.error("Application error:", err);
  if (req.path.startsWith("/api/")) {
    return res.status(500).json({ success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "AquaPiol encountered an unexpected API error." } });
  }
  if (req.flash) req.flash("error_msg", "Something went wrong. Please try again.");
  res.status(500).send("AquaPiol encountered an unexpected error. Check the server terminal for details.");
});

export default app;
export const startServer = async (port = PORT) => {
  try {
    await sequelize.authenticate();
    console.log("✅ Connected to AquaPiol MySQL database.");
    // Safe sync: creates missing tables but does not drop or force-recreate existing data.
    await sequelize.sync();
    // Backward-compatible additive column for databases created by the earlier User model.
    const userColumns = await sequelize.getQueryInterface().describeTable("Users");
    if (!userColumns.isActive) {
      await sequelize.getQueryInterface().addColumn("Users", "isActive", { type: (await import("sequelize")).DataTypes.BOOLEAN, allowNull: false, defaultValue: true });
    }
    console.log("✅ Accounting tables are ready.");
    return await new Promise((resolve, reject) => {
      const server = app.listen(port, () => {
        console.log(`💧 AquaPiol Accounting System running at http://localhost:${port}`);
        resolve(server);
      });
      server.once("error", reject);
    });
  } catch (error) {
    console.error("❌ Startup failed. Verify MySQL is running and models/db.js credentials are correct.", error);
    throw error;
  }
};
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun && !process.env.XIAN_ELECTRON) startServer().catch(() => process.exitCode = 1);
