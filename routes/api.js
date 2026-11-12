import express from "express";
import { Op } from "sequelize";
import { sequelize, Account, JournalEntry, JournalEntryLine, Payment, User } from "../models/Accounting.js";
import { requireApiToken } from "../middleware/apiAuth.js";

const router = express.Router();
const sendError = (res, status, code, message) => res.status(status).json({ success: false, error: { code, message } });
const isValidDate = value => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};
const getServiceUser = async transaction => {
  const id = Number(process.env.API_SERVICE_USER_ID);
  if (!Number.isInteger(id) || id <= 0) return null;
  return User.findOne({ where: { id, isActive: true }, attributes: ["id"], transaction });
};

// Health check intentionally omits database details and does not require a token.
router.get("/health", async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ success: true, data: { service: "aquapiol-accounting-api", version: "v1", status: "ok" } });
  } catch {
    sendError(res, 503, "DATABASE_UNAVAILABLE", "The Accounting database is unavailable.");
  }
});

router.use(requireApiToken);

// Accounting owns the accounts table; consumers receive read-only account data.
router.get("/accounts", async (req, res, next) => {
  try {
    const where = { isActive: true };
    if (req.query.type) where.accountType = req.query.type;
    const accounts = await Account.findAll({
      where,
      attributes: ["id", "accountCode", "accountName", "accountType", "description", "isActive"],
      order: [["accountCode", "ASC"]], raw: true
    });
    res.json({ success: true, data: accounts, meta: { count: accounts.length } });
  } catch (error) { next(error); }
});

// POS and other authorized modules can read posted transaction summaries.
router.get("/transactions", async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100);
    const where = {};
    if (req.query.from || req.query.to) {
      where.entryDate = {};
      if (req.query.from && isValidDate(req.query.from)) where.entryDate[Op.gte] = req.query.from;
      if (req.query.to && isValidDate(req.query.to)) where.entryDate[Op.lte] = req.query.to;
    }
    if (req.query.from && !isValidDate(req.query.from)) return sendError(res, 400, "INVALID_DATE", "from must use YYYY-MM-DD format.");
    if (req.query.to && !isValidDate(req.query.to)) return sendError(res, 400, "INVALID_DATE", "to must use YYYY-MM-DD format.");
    const entries = await JournalEntry.findAll({
      where: { ...where, status: "posted" },
      include: [{ model: JournalEntryLine, attributes: ["accountId", "debit", "credit", "description"] }],
      order: [["entryDate", "DESC"], ["id", "DESC"]], limit
    });
    res.json({ success: true, data: entries, meta: { count: entries.length, limit } });
  } catch (error) { next(error); }
});

// Post a balanced journal entry. The reference number makes retries idempotent.
router.post("/transactions/posting", async (req, res, next) => {
  const { referenceNumber, entryDate, description, lines } = req.body || {};
  if (!referenceNumber || typeof referenceNumber !== "string" || !referenceNumber.trim() || referenceNumber.length > 60) {
    return sendError(res, 400, "INVALID_REFERENCE", "referenceNumber is required and must be at most 60 characters.");
  }
  if (!isValidDate(entryDate)) return sendError(res, 400, "INVALID_DATE", "entryDate must use YYYY-MM-DD format.");
  if (!Array.isArray(lines) || lines.length < 2 || lines.length > 100) return sendError(res, 400, "INVALID_LINES", "Provide between 2 and 100 journal lines.");

  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of lines) {
    const debit = Number(line.debit ?? 0);
    const credit = Number(line.credit ?? 0);
    if (!Number.isInteger(Number(line.accountId)) || Number(line.accountId) <= 0 || !Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0 || (debit === 0 && credit === 0) || (debit > 0 && credit > 0)) {
      return sendError(res, 400, "INVALID_LINE", "Each line needs a valid accountId and either a positive debit or a positive credit, not both.");
    }
    totalDebit += debit;
    totalCredit += credit;
  }
  if (Math.round(totalDebit * 100) !== Math.round(totalCredit * 100) || totalDebit <= 0) {
    return sendError(res, 400, "UNBALANCED_ENTRY", "Total debits must equal total credits and be greater than zero.");
  }

  const transaction = await sequelize.transaction();
  try {
    const serviceUser = await getServiceUser(transaction);
    if (!serviceUser) {
      await transaction.rollback();
      return sendError(res, 503, "API_SERVICE_USER_NOT_CONFIGURED", "Set API_SERVICE_USER_ID to an active Accounting user before accepting API writes.");
    }
    const existing = await JournalEntry.findOne({ where: { referenceNumber: referenceNumber.trim() }, transaction });
    if (existing) {
      await transaction.rollback();
      return sendError(res, 409, "DUPLICATE_REFERENCE", "A journal entry with this referenceNumber already exists.");
    }
    const accountIds = [...new Set(lines.map(line => Number(line.accountId)))];
    const accounts = await Account.findAll({ where: { id: accountIds, isActive: true }, attributes: ["id"], transaction });
    if (accounts.length !== accountIds.length) {
      await transaction.rollback();
      return sendError(res, 400, "INVALID_ACCOUNT", "One or more account IDs do not exist or are inactive in the Accounting module.");
    }
    const entry = await JournalEntry.create({
      referenceNumber: referenceNumber.trim(), entryDate,
      description: typeof description === "string" ? description.slice(0, 5000) : null,
      status: "posted", createdBy: serviceUser.id
    }, { transaction });
    await JournalEntryLine.bulkCreate(lines.map(line => ({
      journalEntryId: entry.id,
      accountId: Number(line.accountId),
      debit: Number(line.debit ?? 0).toFixed(2),
      credit: Number(line.credit ?? 0).toFixed(2),
      description: typeof line.description === "string" ? line.description.slice(0, 255) : null
    })), { transaction });
    await transaction.commit();
    return res.status(201).json({ success: true, data: { id: entry.id, referenceNumber: entry.referenceNumber, entryDate: entry.entryDate, status: entry.status, totalDebit: totalDebit.toFixed(2), totalCredit: totalCredit.toFixed(2) } });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    if (error.name === "SequelizeUniqueConstraintError") return sendError(res, 409, "DUPLICATE_REFERENCE", "A journal entry with this referenceNumber already exists.");
    next(error);
  }
});

// Allow POS to send a completed sale/payment record into Accounting's payment ledger.
router.post("/payments", async (req, res, next) => {
  const { paymentType, paymentMethod = "cash", amount, paymentDate, paymentReference, notes } = req.body || {};
  const numericAmount = Number(amount);
  if (! ["received", "paid"].includes(paymentType)) return sendError(res, 400, "INVALID_PAYMENT_TYPE", "paymentType must be received or paid.");
  if (! ["cash", "bank", "e-wallet"].includes(paymentMethod)) return sendError(res, 400, "INVALID_PAYMENT_METHOD", "paymentMethod must be cash, bank, or e-wallet.");
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) return sendError(res, 400, "INVALID_AMOUNT", "amount must be greater than zero.");
  if (!isValidDate(paymentDate)) return sendError(res, 400, "INVALID_DATE", "paymentDate must use YYYY-MM-DD format.");
  try {
    const serviceUser = await getServiceUser();
    if (!serviceUser) return sendError(res, 503, "API_SERVICE_USER_NOT_CONFIGURED", "Set API_SERVICE_USER_ID to an active Accounting user before accepting API writes.");
    const payment = await Payment.create({
      paymentType, paymentMethod, amount: numericAmount.toFixed(2), paymentDate,
      paymentReference: typeof paymentReference === "string" ? paymentReference.slice(0, 60) : null,
      notes: typeof notes === "string" ? notes.slice(0, 5000) : null,
      createdBy: serviceUser.id
    });
    res.status(201).json({ success: true, data: { id: payment.id, paymentType: payment.paymentType, paymentMethod: payment.paymentMethod, amount: payment.amount, paymentDate: payment.paymentDate, paymentReference: payment.paymentReference } });
  } catch (error) { next(error); }
});

export default router;
