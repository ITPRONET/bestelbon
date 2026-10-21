"use client";
import { useEffect } from "react";
// Fallback: if an invitation link lands on the home page, forward the session to /auth/bevestig.
export default function HashRedirect() {
  useEffect(() => {
    if (/access_token=|error_description=/.test(location.hash)) location.replace("/auth/bevestig" + location.hash);
  }, []);
  return null;
}
