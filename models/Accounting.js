import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";
import { User } from "./userModel.js";

const Account = sequelize.define("Account", {
  accountCode: { type: DataTypes.STRING(20), unique: true, allowNull: false },
  accountName: { type: DataTypes.STRING(120), allowNull: false },
  accountType: { type: DataTypes.ENUM("asset", "liability", "equity", "revenue", "expense"), allowNull: false },
  description: DataTypes.STRING(255), balance: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: "accounts" });

const Customer = sequelize.define("Customer", {
  name: { type: DataTypes.STRING(150), allowNull: false }, email: DataTypes.STRING(150),
  phone: DataTypes.STRING(40), address: DataTypes.STRING(255), notes: DataTypes.TEXT,
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: "customers" });

const Supplier = sequelize.define("Supplier", {
  name: { type: DataTypes.STRING(150), allowNull: false }, contactPerson: DataTypes.STRING(120),
  email: DataTypes.STRING(150), phone: DataTypes.STRING(40), address: DataTypes.STRING(255),
  notes: DataTypes.TEXT, isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: "suppliers" });

const Invoice = sequelize.define("Invoice", {
  invoiceNumber: { type: DataTypes.STRING(50), unique: true, allowNull: false },
  invoiceDate: { type: DataTypes.DATEONLY, allowNull: false }, dueDate: DataTypes.DATEONLY,
  subtotal: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
  taxAmount: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
  totalAmount: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
  status: { type: DataTypes.ENUM("pending", "paid", "partial", "overdue", "cancelled"), defaultValue: "pending" }
}, { tableName: "invoices" });

const InvoiceItem = sequelize.define("InvoiceItem", {
  description: { type: DataTypes.STRING(255), allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  unitPrice: { type: DataTypes.DECIMAL(15,2), allowNull: false },
  subtotal: { type: DataTypes.DECIMAL(15,2), allowNull: false }
}, { tableName: "invoice_items" });

const Payment = sequelize.define("Payment", {
  invoiceId: { type: DataTypes.INTEGER, allowNull: true }, customerId: { type: DataTypes.INTEGER, allowNull: true },
  supplierId: { type: DataTypes.INTEGER, allowNull: true }, accountId: { type: DataTypes.INTEGER, allowNull: true },
  paymentReference: DataTypes.STRING(60),
  paymentType: { type: DataTypes.ENUM("received", "paid"), allowNull: false },
  paymentMethod: { type: DataTypes.ENUM("cash", "bank", "e-wallet"), allowNull: false, defaultValue: "cash" },
  amount: { type: DataTypes.DECIMAL(15,2), allowNull: false }, paymentDate: { type: DataTypes.DATEONLY, allowNull: false },
  notes: DataTypes.TEXT
}, { tableName: "payments" });

const Expense = sequelize.define("Expense", {
  supplierId: { type: DataTypes.INTEGER, allowNull: true }, expenseAccountId: { type: DataTypes.INTEGER, allowNull: true },
  paidFromAccountId: { type: DataTypes.INTEGER, allowNull: true }, expenseName: { type: DataTypes.STRING(150), allowNull: false },
  amount: { type: DataTypes.DECIMAL(15,2), allowNull: false }, expenseDate: { type: DataTypes.DATEONLY, allowNull: false },
  paymentMethod: { type: DataTypes.ENUM("cash", "bank", "e-wallet"), defaultValue: "cash" }, description: DataTypes.TEXT
}, { tableName: "expenses" });

const JournalEntry = sequelize.define("JournalEntry", {
  referenceNumber: { type: DataTypes.STRING(60), unique: true, allowNull: false },
  entryDate: { type: DataTypes.DATEONLY, allowNull: false }, description: DataTypes.TEXT,
  status: { type: DataTypes.ENUM("draft", "posted", "void"), defaultValue: "draft" }
}, { tableName: "journal_entries" });

const JournalEntryLine = sequelize.define("JournalEntryLine", {
  debit: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 }, credit: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
  description: DataTypes.STRING(255)
}, { tableName: "journal_entry_lines" });

// One-to-many associations from the Accounting Management ERD.
Customer.hasMany(Invoice, { foreignKey: { name: "customerId", allowNull: false }, onDelete: "RESTRICT" });
Invoice.belongsTo(Customer, { foreignKey: "customerId" });
User.hasMany(Invoice, { as: "createdInvoices", foreignKey: { name: "createdBy", allowNull: false }, onDelete: "RESTRICT" });
Invoice.belongsTo(User, { as: "creator", foreignKey: "createdBy" });
Invoice.hasMany(InvoiceItem, { foreignKey: { name: "invoiceId", allowNull: false }, onDelete: "CASCADE" });
InvoiceItem.belongsTo(Invoice, { foreignKey: "invoiceId" });
Invoice.hasMany(Payment, { foreignKey: "invoiceId", onDelete: "SET NULL" });
Payment.belongsTo(Invoice, { foreignKey: "invoiceId" });
User.hasMany(Payment, { foreignKey: { name: "createdBy", allowNull: false }, onDelete: "RESTRICT" });
Payment.belongsTo(User, { as: "creator", foreignKey: "createdBy" });
Customer.hasMany(Payment, { foreignKey: "customerId", onDelete: "SET NULL" });
Payment.belongsTo(Customer, { foreignKey: "customerId" });
Supplier.hasMany(Payment, { foreignKey: "supplierId", onDelete: "SET NULL" });
Payment.belongsTo(Supplier, { foreignKey: "supplierId" });
Account.hasMany(Payment, { foreignKey: "accountId", onDelete: "RESTRICT" });
Payment.belongsTo(Account, { foreignKey: "accountId" });
Supplier.hasMany(Expense, { foreignKey: "supplierId", onDelete: "SET NULL" });
Expense.belongsTo(Supplier, { foreignKey: "supplierId" });
Account.hasMany(Expense, { as: "expenseCategory", foreignKey: "expenseAccountId", onDelete: "RESTRICT" });
Account.hasMany(Expense, { as: "paidFrom", foreignKey: "paidFromAccountId", onDelete: "RESTRICT" });
Expense.belongsTo(Account, { as: "expenseCategory", foreignKey: "expenseAccountId" });
Expense.belongsTo(Account, { as: "paidFrom", foreignKey: "paidFromAccountId" });
User.hasMany(Expense, { foreignKey: { name: "createdBy", allowNull: false }, onDelete: "RESTRICT" });
Expense.belongsTo(User, { as: "creator", foreignKey: "createdBy" });
User.hasMany(JournalEntry, { foreignKey: { name: "createdBy", allowNull: false }, onDelete: "RESTRICT" });
JournalEntry.belongsTo(User, { as: "creator", foreignKey: "createdBy" });
JournalEntry.hasMany(JournalEntryLine, { foreignKey: { name: "journalEntryId", allowNull: false }, onDelete: "CASCADE" });
JournalEntryLine.belongsTo(JournalEntry, { foreignKey: "journalEntryId" });
Account.hasMany(JournalEntryLine, { foreignKey: { name: "accountId", allowNull: false }, onDelete: "RESTRICT" });
JournalEntryLine.belongsTo(Account, { foreignKey: "accountId" });

export { sequelize, User, Account, Customer, Supplier, Invoice, InvoiceItem, Payment, Expense, JournalEntry, JournalEntryLine };
