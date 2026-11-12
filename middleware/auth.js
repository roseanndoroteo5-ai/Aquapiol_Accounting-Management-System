export function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  if (req.session.user.role !== "admin") {
    req.flash("error_msg", "Admin access is required for that page.");
    return res.redirect("/dashboard");
  }
  next();
}
