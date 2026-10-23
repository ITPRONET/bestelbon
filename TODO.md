# BestelBon – nog te doen

## Open problemen
- [ ] **Uitnodigingsmail komt niet aan** (22-10-2026). Supabase verstuurt de invite correct
  (auth-log `user_invited`, status 200, via SMTP info@bestelbon.eu), maar de mail naar een
  telenet.be-adres kwam niet aan. Te controleren:
  - spam/ongewenst bij Telenet, bounce-mail in de mailbox info@bestelbon.eu
  - DKIM inschakelen voor bestelbon.eu bij de hosting (SPF en DMARC p=none staan al)
  - test met een Gmail-adres (Beheerder → klant → "extra login")
  - eventueel transactionele mailprovider (Resend/Postmark/Brevo) als SMTP voor Supabase

## Wacht op accounts
- [ ] Brevo (of Resend) als mailprovider: domein bestelbon.eu verifiëren (DKIM), daarna in Vercel
  SMTP_HOST=smtp-relay.brevo.com, SMTP_PORT=587, SMTP_USER, SMTP_PASS, MAIL_FROM_ADDRESS=info@bestelbon.eu,
  ADMIN_EMAIL=info@bestelbon.eu; en dezelfde SMTP in Supabase (lost ook de uitnodigingsmail op)
- [ ] VERCEL_TOKEN in Vercel (eigen domeinen voor Pro automatisch koppelen)
- [ ] Mollie-account (online betalen + domiciliëring abonnementen)
- [ ] Meta WhatsApp Business API (meldingen aan uitbaters)

## Voor de lancering (29 nov)
- [ ] Vercel Pro en Supabase Pro
- [ ] PHP op de hosting naar 8.4/8.3 (PHP2Shell)
- [ ] Juridische teksten laten nalezen
- [ ] ALLOW_ORDERS_WITHOUT_PRINTER uit, demo-data opruimen
- [ ] Echte Star-printer testen

## Later
- [ ] Mollie: online betalen en domiciliëring abonnementen
- [ ] E-mail naar klant bij bestelling, WhatsApp naar uitbater
- [ ] Peppol access point koppelen (nu: UBL downloaden)
- [ ] Vercel Pro en Supabase Pro voor de lancering
