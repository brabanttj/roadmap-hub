import express from "express";
import path from "node:path";

// Long-cache immutable hashed assets, never-cache app shell, SPA fallback,
// baseline hardening headers.
export function mountStatic(app, distDir) {
  app.use((req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("X-Frame-Options", "SAMEORIGIN");
    res.set("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  app.use(
    "/assets",
    express.static(path.join(distDir, "assets"), {
      immutable: true,
      maxAge: "1y",
    })
  );

  app.use(express.static(distDir, { index: false }));

  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.set("Cache-Control", "no-store, must-revalidate");
    res.sendFile(path.join(distDir, "index.html"));
  });
}
