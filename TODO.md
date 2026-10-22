# BestelBon – nog te doen

## Open problemen
- [ ] **Uitnodigingsmail komt niet aan** (22-10-2026). Supabase verstuurt de invite correct
  (auth-log `user_invited`, status 200, via SMTP info@bestelbon.eu), maar de mail naar een
  telenet.be-adres kwam niet aan. Te controleren:
  - spam/ongewenst bij Telenet, bounce-mail in de mailbox info@bestelbon.eu
  - DKIM inschakelen voor bestelbon.eu bij de hosting (SPF en DMARC p=none staan al)
  - test met een Gmail-adres (Beheerder → klant → "extra login")
  - eventueel transactionele mailprovider (Resend/Postmark/Brevo) als SMTP voor Supabase

## Later
- [ ] Mollie: online betalen en domiciliëring abonnementen
- [ ] E-mail naar klant bij bestelling, WhatsApp naar uitbater
- [ ] Peppol access point koppelen (nu: UBL downloaden)
- [ ] Vercel Pro en Supabase Pro voor de lancering
