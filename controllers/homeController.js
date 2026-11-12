// Keep the original home route, but direct authenticated users to the app dashboard.
export const homePage = (req, res) => {
  if (req.session?.user) return res.redirect("/dashboard");
  return res.redirect("/login");
};
