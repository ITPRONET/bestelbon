# BestelBon

Online bestelplatform voor frituren, pizzeria's en afhaalzaken. Bestellingen printen automatisch op de bonprinter van de zaak (Star CloudPRNT).

## Onderdelen (v0.1)
- `/{slug}` – bestelpagina van een zaak (menu, opties, afhalen/levering, betalen bij levering/afhaling)
- `/{slug}/bestelling/{id}` – statuspagina voor de klant
- `/api/orders` – maakt de bestelling aan; prijzen worden op de server herberekend
- `/api/cloudprnt/{token}` – Star CloudPRNT (poll, bon ophalen, bevestigen)
- `/beheer` – inloggen met e-maillink, bestellingen van vandaag, printers toevoegen

## Omgevingsvariabelen
Zie `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` is geheim en hoort alleen in Vercel.

## Database
Supabase project `Bestelbon` (eu-central-1). Schema en RLS worden beheerd via migraties in Supabase.
