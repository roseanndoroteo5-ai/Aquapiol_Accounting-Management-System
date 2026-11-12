import { Op } from "sequelize";
import { Account, Payment, Expense, Customer, Supplier, User, JournalEntry, JournalEntryLine } from "../models/Accounting.js";

export const accountsPage = async (req, res) => {
  const accounts = await Account.findAll({ order: [["accountCode", "ASC"]], raw: true });
  res.render("accounting/accounts", { title: "Chart of Accounts | AquaPiol", page: "accounts", accounts });
};
export const addAccount = async (req, res) => {
  try {
    await Account.create({ accountCode: req.body.accountCode.trim(), accountName: req.body.accountName.trim(), accountType: req.body.accountType, description: req.body.description || null });
    req.flash("success_msg", "Account added successfully.");
  } catch (e) { console.error(e); req.flash("error_msg", "Unable to add account. Check if the account code already exists."); }
  res.redirect("/accounts");
};
export const transactionsPage = async (req, res) => {
  const [payments, expenses] = await Promise.all([
    Payment.findAll({ order: [["paymentDate", "DESC"]], limit: 100, raw: true }),
    Expense.findAll({ order: [["expenseDate", "DESC"]], limit: 100, raw: true })
  ]);
  res.render("accounting/transactions", { title: "Transactions | AquaPiol", page: "transactions", payments, expenses });
};
export const addPayment = async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!(amount > 0)) throw new Error("Amount must be greater than zero.");
    await Payment.create({ paymentType: req.body.paymentType, paymentMethod: req.body.paymentMethod, amount, paymentDate: req.body.paymentDate, paymentReference: req.body.paymentReference || null, notes: req.body.notes || null, createdBy: req.session.user.id });
    req.flash("success_msg", "Payment recorded successfully.");
  } catch (e) { console.error(e); req.flash("error_msg", "Unable to record payment. Verify the form and database setup."); }
  res.redirect("/transactions");
};
export const addExpense = async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!(amount > 0)) throw new Error("Amount must be greater than zero.");
    await Expense.create({ expenseName: req.body.expenseName.trim(), amount, expenseDate: req.body.expenseDate, paymentMethod: req.body.paymentMethod, description: req.body.description || null, createdBy: req.session.user.id });
    req.flash("success_msg", "Expense recorded successfully.");
  } catch (e) { console.error(e); req.flash("error_msg", "Unable to record expense. Verify the form and database setup."); }
  res.redirect("/transactions");
};
export const reportsPage = async (req, res) => {
  const [income, expenses, accounts, journalEntries] = await Promise.all([
    Payment.sum("amount", { where: { paymentType: "received" } }), Expense.sum("amount"),
    Account.findAll({ order: [["accountCode", "ASC"]], raw: true }),
    JournalEntry.findAll({ order: [["entryDate", "DESC"]], limit: 50, raw: true })
  ]);
  res.render("accounting/reports", { title: "Financial Reports | AquaPiol", page: "reports", income: Number(income || 0).toFixed(2), expenses: Number(expenses || 0).toFixed(2), net: (Number(income || 0) - Number(expenses || 0)).toFixed(2), accounts, journalEntries });
};
export const usersPage = async (req, res) => {
  const users = await User.findAll({ attributes: ["id", "name", "email", "role", "isActive", "createdAt"], order: [["createdAt", "DESC"]], raw: true });
  res.render("accounting/users", { title: "User Management | AquaPiol", page: "users", users });
};
export const addUser = async (req, res) => {
  try {
    const bcrypt = (await import("bcrypt")).default;
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || password.length < 8 || !["admin", "staff"].includes(role)) throw new Error("Invalid user details.");
    await User.create({ name: name.trim(), email: email.trim().toLowerCase(), password: await bcrypt.hash(password, 12), role, isActive: true });
    req.flash("success_msg", "User account created.");
  } catch (e) { console.error(e); req.flash("error_msg", "Unable to create user. Email may already exist; password must be at least 8 characters."); }
  res.redirect("/users");
};
export const toggleUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user || user.id === req.session.user.id) throw new Error("Cannot deactivate this account.");
    user.isActive = !user.isActive; await user.save();
    req.flash("success_msg", "User status updated.");
  } catch (e) { req.flash("error_msg", "Unable to update user status."); }
  res.redirect("/users");
};

export const customersPage = async (req, res) => {
  const customers = await Customer.findAll({ order: [["createdAt", "DESC"]], raw: true });
  res.render("accounting/people", { title: "Customers | AquaPiol", page: "customers", peopleTitle: "Customers", peopleType: "customer", people: customers });
};
export const suppliersPage = async (req, res) => {
  const suppliers = await Supplier.findAll({ order: [["createdAt", "DESC"]], raw: true });
  res.render("accounting/people", { title: "Suppliers | AquaPiol", page: "suppliers", peopleTitle: "Suppliers", peopleType: "supplier", people: suppliers });
};
export const addCustomer = async (req, res) => {
  try { await Customer.create({ name: req.body.name.trim(), email: req.body.email || null, phone: req.body.phone || null, address: req.body.address || null }); req.flash("success_msg", "Customer saved."); }
  catch (e) { console.error(e); req.flash("error_msg", "Unable to save customer."); }
  res.redirect("/customers");
};
export const addSupplier = async (req, res) => {
  try { await Supplier.create({ name: req.body.name.trim(), contactPerson: req.body.contactPerson || null, email: req.body.email || null, phone: req.body.phone || null, address: req.body.address || null }); req.flash("success_msg", "Supplier saved."); }
  catch (e) { console.error(e); req.flash("error_msg", "Unable to save supplier."); }
  res.redirect("/suppliers");
};
export const invoicesPage = async (req, res) => {
  const [invoices, customers] = await Promise.all([
    Invoice.findAll({ include: [{ model: Customer, attributes: ["name"] }], order: [["invoiceDate", "DESC"]], raw: true, nest: true }),
    Customer.findAll({ where: { isActive: true }, order: [["name", "ASC"]], raw: true })
  ]);
  res.render("accounting/invoices", { title: "Invoices | AquaPiol", page: "invoices", invoices, customers });
};
export const addInvoice = async (req, res) => {
  const transaction = await Invoice.sequelize.transaction();
  try {
    const quantity = Math.max(1, Number.parseInt(req.body.quantity, 10) || 1);
    const unitPrice = Number(req.body.unitPrice);
    if (!(unitPrice >= 0) || !req.body.customerId || !req.body.description) throw new Error("Invalid invoice details.");
    const subtotal = quantity * unitPrice;
    const taxAmount = Number(req.body.taxAmount || 0);
    if (!(taxAmount >= 0)) throw new Error("Invalid tax amount.");
    const invoice = await Invoice.create({ invoiceNumber: `AP-${Date.now()}`, customerId: Number(req.body.customerId), invoiceDate: req.body.invoiceDate, dueDate: req.body.dueDate || null, subtotal, taxAmount, totalAmount: subtotal + taxAmount, status: "pending", createdBy: req.session.user.id }, { transaction });
    await InvoiceItem.create({ invoiceId: invoice.id, description: req.body.description.trim(), quantity, unitPrice, subtotal }, { transaction });
    await transaction.commit(); req.flash("success_msg", "Invoice created successfully.");
  } catch (e) { await transaction.rollback(); console.error(e); req.flash("error_msg", "Unable to create invoice. Check customer and invoice details."); }
  res.redirect("/invoices");
};
