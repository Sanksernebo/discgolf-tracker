import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["et", "en"],
  defaultLocale: "et",
  // "always" means `/` 307-redirects to `/et`. We deliberately avoid
  // "as-needed" because that mode uses NextResponse.rewrite() under the
  // hood, which behind Zone's Apache mod_proxy causes Next to try to
  // proxy `https://localhost:3000/et` internally → ECONNREFUSED. The
  // redirect flavour has no such loopback fetch.
  localePrefix: "always",
});
