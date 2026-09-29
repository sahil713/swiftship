# SwiftShip – UK Shipping & Logistics

Customers get instant quotes, book and pay for deliveries, and track shipments. Staff manage bookings, pricing and customers. Drivers update statuses and record proof of delivery.

- **Backend:** Ruby on Rails 8 API + PostgreSQL (`backend/`)
- **Frontend:** React 18 + Vite, React Router, Framer Motion (`frontend/`)
- **Themes:** light and dark, with a toggle in the header. The default follows the device setting, and the choice is saved.
- **Landing page:** full-screen video hero with parallax, hover-to-play video step cards, a parallax video band, an animated delivery route and scroll-reveal animations. Videos come from Pexels (free licence) and are in `frontend/public/videos/`. With reduced motion turned on, videos don't autoplay.

## Running locally

Requires Docker and Node 18+.

```bash
# 1. API + database (http://localhost:3000). The first run installs gems, then creates, migrates and seeds the database.
echo "HOST_UID=$(id -u)" > .env && echo "HOST_GID=$(id -g)" >> .env
docker compose up -d

# 2. Frontend (http://localhost:5173). It proxies /api to Rails.
cd frontend && npm install && npm run dev
```

Demo accounts (password `password123`):

| Role | Email | Lands on |
|---|---|---|
| Admin | admin@swiftship.example | `/admin` – everything, including pricing, refunds, staff, settings |
| Operations | ops@swiftship.example | `/admin` – bookings, statuses, customers, enquiries |
| Driver | driver@swiftship.example | `/driver` – assigned jobs, status updates, proof of delivery |
| Customer | customer@example.com | `/account` – orders, saved addresses, profile |

Test card: `4242 4242 4242 4242`, any future expiry and any CVC. `4000 0000 0000 0002` is declined.

Useful commands:

```bash
docker compose exec backend bin/rails db:seed                              # re-seed (idempotent)
docker compose exec backend bin/rails db:reset                             # wipe and re-seed
docker compose exec -e RAILS_ENV=test backend bin/rails test               # backend tests
ls backend/tmp/mails                                                       # emails "sent" in development
```

## How it works

**Booking lifecycle:** `quote_requested → awaiting_payment → booked → collected → in_transit → out_for_delivery → delivered`, plus `failed_delivery`, `exception` and `cancelled`. Every change is written to `status_events` with a timestamp, the user and an optional note or location. Allowed transitions are defined in `Booking::TRANSITIONS`.

**Quotes:** if the customer gives a weight and nothing needs review, the price is confirmed automatically and they can pay straight away. Otherwise staff confirm the price from the admin booking page. Auto-confirmation can be turned off in Settings.

**Pricing** (`backend/app/services/price_calculator.rb`):
- The service's base price, plus a per-kg rate above its included weight.
- Chargeable weight is the greater of actual and volumetric weight (L×W×H ÷ 5000).
- An inter-region route charge applies when collection and delivery are in different regions.
- Area surcharges apply for remote areas and Northern Ireland.
- Fragile, bulky and weekend-collection surcharges are added when relevant.
- Admins can edit all of these under **Services & pricing**.

**Service area** (`service_area.rb`):
- Postcodes are checked against the UK format, then against the delivery-area table, then confirmed with [postcodes.io](https://postcodes.io). If postcodes.io is unreachable, only the format is checked.
- Irish Eircodes, the Channel Islands and the Isle of Man get a clear "outside our service area" message.
- **Northern Ireland is served by default and can be switched off in admin Settings**, pending the business decision the requirements ask for.

**Notifications:** important status changes send an email (written to `backend/tmp/mails` in development) and log an SMS in the `notifications` table. Staff can see both on the booking page.

## Not production-ready yet

- **Payments are simulated** (`PaymentProcessor`). Replace with Stripe PaymentIntents and Stripe Elements so card data never reaches this server.
- **SMS** is logged, not sent. Add a provider such as Twilio in `BookingNotifier`.
- **Email** needs SMTP or a provider configured for production.
- **Legal pages** are template wording and need review by a legal adviser.
- **Landing-page stats** ("2.4M parcels", "4.8/5") are placeholder marketing copy.
- **Proof-of-delivery images** are stored in the database as data URLs. Move them to Active Storage/S3 at scale.
- **Hosting:** add HTTPS, backups, a strong `JWT_SECRET` and a production `FRONTEND_ORIGIN` for CORS.
