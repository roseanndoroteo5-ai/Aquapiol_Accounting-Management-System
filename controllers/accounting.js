// Backward-compatible controller export retained for existing XianFire route conventions.
import { Account } from "../models/Accounting.js";
export const accounting = {
  index: async (req, res) => {
    const accounts = await Account.findAll({ order: [["accountCode", "ASC"]] });
    res.render("accounting/accounts", { title: "Chart of Accounts | AquaPiol", page: "accounts", accounts });
  }
};
