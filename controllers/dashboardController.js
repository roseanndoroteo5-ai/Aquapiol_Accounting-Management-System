import { Op } from "sequelize";
import { Payment, Expense, Invoice, User } from "../models/Accounting.js";

export const dashboard = async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [incomeTotal, expenseTotal, invoiceCount, userCount, recentPayments, recentExpenses] = await Promise.all([
      Payment.sum("amount", { where: { paymentType: "received" } }),
      Expense.sum("amount"), Invoice.count(), User.count(),
      Payment.findAll({ order: [["createdAt", "DESC"]], limit: 5 }),
      Expense.findAll({ order: [["createdAt", "DESC"]], limit: 5 })
    ]);
    const monthlyLabels = [];
    const monthlyIncome = [];
    const monthlyExpenses = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(); date.setDate(1); date.setMonth(date.getMonth() - i);
      const start = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10);
      const label = date.toLocaleString("en", { month: "short" });
      const [inc, exp] = await Promise.all([
        Payment.sum("amount", { where: { paymentType: "received", paymentDate: { [Op.between]: [start, end] } } }),
        Expense.sum("amount", { where: { expenseDate: { [Op.between]: [start, end] } } })
      ]);
      monthlyLabels.push(label); monthlyIncome.push(Number(inc || 0)); monthlyExpenses.push(Number(exp || 0));
    }
    const income = Number(incomeTotal || 0), expenses = Number(expenseTotal || 0);
    res.render("dashboard", {
      title: "Dashboard | AquaPiol", page: "dashboard", income: income.toFixed(2),
      expenses: expenses.toFixed(2), net: (income - expenses).toFixed(2), invoiceCount, userCount,
      today, recentPayments, recentExpenses,
      chartLabels: JSON.stringify(monthlyLabels), chartIncome: JSON.stringify(monthlyIncome), chartExpenses: JSON.stringify(monthlyExpenses)
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    req.flash("error_msg", "Dashboard data could not be loaded. Check your database tables.");
    res.render("dashboard", { title: "Dashboard | AquaPiol", page: "dashboard", income: "0.00", expenses: "0.00", net: "0.00", invoiceCount: 0, userCount: 0, chartLabels: "[]", chartIncome: "[]", chartExpenses: "[]", recentPayments: [], recentExpenses: [] });
  }
};
