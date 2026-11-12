import { User } from "../models/userModel.js";

export const showLogin = (req, res) => {
  if (req.session.user) return res.redirect("/dashboard");
  res.render("auth/login", { title: "Sign in | AquaPiol" });
};

export const login = async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!email || !password) {
      req.flash("error_msg", "Please enter your email and password.");
      return res.redirect("/login");
    }
    const user = await User.findOne({ where: { email } });
    const bcrypt = (await import("bcrypt")).default;
    if (!user || user.isActive === false || !(await bcrypt.compare(password, user.password))) {
      req.flash("error_msg", "Invalid login credentials or inactive account.");
      return res.redirect("/login");
    }
    if (!["admin", "staff"].includes(user.role)) {
      req.flash("error_msg", "This account does not have an authorized system role.");
      return res.redirect("/login");
    }
    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    req.session.save(() => res.redirect("/dashboard"));
  } catch (error) {
    console.error("Login error:", error);
    req.flash("error_msg", "Unable to sign in. Check the database connection.");
    res.redirect("/login");
  }
};

export const logout = (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
};
