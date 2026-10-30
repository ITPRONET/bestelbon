// Paths on bestelbon.eu that belong to the app, and names a restaurant can never use as its address.
export const APP_PATHS = ["beheer", "api", "auth", "aanmelden", "bestellen", "privacy", "voorwaarden", "verwerkersovereenkomst", "_next", "favicon.ico"];
export const RESERVED_SLUGS = new Set([
  ...APP_PATHS, "wp-admin", "wp-content", "wp-includes", "wp-json", "wp-login.php", "xmlrpc.php", "feed", "sitemap", "sitemap.xml", "robots.txt",
  "blog", "contact", "demo", "prijzen", "over-ons", "faq", "app", "admin", "login", "inloggen", "bestellen", "www", "site", "info", "help", "support",
]);
