import { timingSafeEqual } from "node:crypto";

/** Protect module-to-module API requests with a shared Bearer token. */
export function requireApiToken(req, res, next) {
  const configuredToken = process.env.API_BEARER_TOKEN;
  if (!configuredToken) {
    return res.status(503).json({
      success: false,
      error: { code: "API_NOT_CONFIGURED", message: "The Accounting API is not configured. Set API_BEARER_TOKEN on the server." }
    });
  }

  const authorization = req.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "A valid Bearer token is required." } });
  }

  const supplied = Buffer.from(match[1], "utf8");
  const expected = Buffer.from(configuredToken, "utf8");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "A valid Bearer token is required." } });
  }
  next();
}
