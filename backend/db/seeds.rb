# Idempotent seed data: UK regions, service-area rules, services, surcharges, demo users and bookings.
# Seeds run on every production boot, so existing records are never overwritten – admin edits stick.

regions = [
  ["London", "mainland", %w[E EC N NW SE SW W WC], 0, 0],
  ["South East", "mainland", %w[BN BR CR CT DA GU HA HP KT ME MK OX PO RG RH SL SM SO TN TW UB EN IG RM WD], 0, 0],
  ["East of England", "mainland", %w[AL CB CM CO IP LU NR PE SG SS], 0, 0],
  ["South West", "mainland", %w[BA BH BS DT EX GL PL SN SP TA TQ TR], 0, 0],
  ["Midlands", "mainland", %w[B CV DE DY HR LE LN NG NN ST TF WR WS WV], 0, 0],
  ["North West", "mainland", %w[BB BL CA CH CW FY L LA M OL PR SK WA WN], 0, 0],
  ["Yorkshire & North East", "mainland", %w[BD DH DL DN HD HG HU HX LS NE S SR TS WF YO], 0, 0],
  ["Wales", "mainland", %w[CF LD LL NP SA SY], 0, 0],
  ["Scotland", "mainland", %w[AB DD DG EH FK G KA KY ML PA PH TD], 0, 1],
  ["Scottish Highlands & Islands", "remote", %w[IV HS KW ZE], 2500, 2],
  ["Northern Ireland", "northern_ireland", %w[BT], 3500, 2],
  ["Channel Islands & Isle of Man", "excluded", %w[GY JE IM], 0, 0]
]

regions.each do |name, zone, areas, surcharge, extra_days|
  DeliveryArea.find_or_create_by!(name:) do |area|
    area.assign_attributes(zone:, postcode_areas: areas, surcharge_pence: surcharge, extra_transit_days: extra_days,
                           serviced: !%w[excluded northern_ireland].include?(zone),
                           notes: case zone
                                  when "remote" then "Remote area – allow extra transit time. Some islands are served by ferry."
                                  when "northern_ireland" then "We don't provide services to or from Ireland – this includes the Republic of Ireland and Northern Ireland."
                                  when "excluded" then "Crown Dependencies are outside the UK and not currently served."
                                  end)
  end
end

# Exceptions to the normal UK service area. Requests touching these areas are accepted
# but flagged for admin review. Anything not listed is served normally.
# Ireland (Eircodes and Northern Ireland's BT area) is always blocked in code, not here.
[
  ["IV", "outside", "Scottish Highlands (Inverness) – north of Glasgow, not normally served"],
  ["AB", "outside", "Aberdeen & Aberdeenshire – north of Glasgow, not normally served"],
  ["KW", "outside", "Caithness & Orkney – north of Glasgow, not normally served"],
  ["HS", "outside", "Outer Hebrides – north of Glasgow, not normally served"],
  ["ZE", "outside", "Shetland – north of Glasgow, not normally served"],
  ["PH", "outside", "Perth & Highland Perthshire – north of Glasgow, not normally served"],
  ["DD", "outside", "Dundee & Angus – north of Glasgow, not normally served"],
  ["TQ", "outside", "Torquay & South Devon – beyond the EX area, not normally served"],
  ["TR", "outside", "Cornwall (Truro) – beyond the EX area, not normally served"],
  ["SY", "outside", "Shrewsbury & mid-Wales – not normally served; occasional exceptions depending on location/job"],
  ["TN", "restricted", "Tonbridge, Tunbridge Wells & the Kent Weald – very rarely served, case by case"],
  ["BH", "restricted", "Bournemouth & Poole – very rarely served, case by case"],
  ["SO", "restricted", "Southampton – very rarely served, case by case"]
].each do |postcode_area, level, note|
  PostcodeRule.find_or_create_by!(postcode_area:) { |rule| rule.assign_attributes(level:, note:) }
end

services = [
  { slug: "standard", name: "Standard", tagline: "Reliable, great-value delivery across the UK",
    description: "Our everyday service for parcels and packages. Collected from your door and delivered within 2–3 working days.",
    transit_time: "2–3 working days", base_price_pence: 699, price_per_kg_pence: 45, included_kg: 5, max_weight_kg: 30,
    restrictions: "Up to 30 kg per item. Maximum length 120 cm.", position: 1 },
  { slug: "express", name: "Express", tagline: "Next working day, tracked end to end",
    description: "Priority handling and next-working-day delivery to most UK mainland addresses when booked by 5pm.",
    transit_time: "Next working day", base_price_pence: 1299, price_per_kg_pence: 65, included_kg: 5, max_weight_kg: 30,
    cutoff_hour: 17, restrictions: "Up to 30 kg per item. Remote areas and Northern Ireland add 1–2 days.", position: 2 },
  { slug: "same-day", name: "Same Day", tagline: "Collected and delivered today",
    description: "A dedicated courier collects within hours and delivers directly – ideal for urgent documents and parts. Available within the same region.",
    transit_time: "Same day", base_price_pence: 3499, price_per_kg_pence: 90, included_kg: 10, max_weight_kg: 50,
    cutoff_hour: 12, restrictions: "Book before 12pm. Collection and delivery must be in the same region.", position: 3 },
  { slug: "fragile-bulky", name: "Fragile & Bulky", tagline: "Two-person handling for large or delicate items",
    description: "For furniture, artwork, electronics and oversized items. Two-person collection and delivery, blanket wrapped.",
    transit_time: "3–5 working days", base_price_pence: 4999, price_per_kg_pence: 35, included_kg: 30, max_weight_kg: 150,
    restrictions: "Up to 150 kg per item. Items over 2 m long need a manual quote.", position: 4 }
]

services.each do |attrs|
  Service.find_or_create_by!(slug: attrs[:slug]) { |service| service.assign_attributes(attrs) }
end

surcharges = [
  { code: "inter_region", name: "Inter-region route", kind: "fixed", amount: 400,
    description: "Applied when collection and delivery are in different regions." },
  { code: "fragile", name: "Fragile handling", kind: "percent", amount: 15,
    description: "Extra packaging checks and careful handling for fragile items." },
  { code: "bulky", name: "Bulky item", kind: "fixed", amount: 1500,
    description: "Items over 120 cm in any dimension or over 30 kg chargeable weight." },
  { code: "weekend_collection", name: "Weekend collection", kind: "percent", amount: 20,
    description: "Collections on Saturday or Sunday." }
]

surcharges.each do |attrs|
  Surcharge.find_or_create_by!(code: attrs[:code]) { |surcharge| surcharge.assign_attributes(attrs) }
end

Setting::DEFAULTS.each_key { |key| Setting.find_or_create_by!(key:) { _1.value = Setting::DEFAULTS[key] } }

# Production must supply SEED_PASSWORD so public deployments never use the well-known demo password.
seed_password = if Rails.env.production?
  ENV.fetch("SEED_PASSWORD") { abort "Set SEED_PASSWORD before seeding production" }
else
  ENV.fetch("SEED_PASSWORD", "password123")
end

def seed_user(email, name, role, phone, password)
  User.find_by(email:) || User.create!(email:, name:, role:, phone:, password:)
end

admin = seed_user("admin@swiftship.example", "Alex Admin", "admin", "020 7946 0001", seed_password)
ops = seed_user("ops@swiftship.example", "Olivia Operations", "operations", "020 7946 0002", seed_password)
driver = seed_user("driver@swiftship.example", "Dan Driver", "driver", "07700 900003", seed_password)
seed_user("driver2@swiftship.example", "Priya Patel", "driver", "07700 900004", seed_password)
customer = seed_user("customer@example.com", "Casey Customer", "customer", "07700 900123", seed_password)

if Booking.none?
  standard = Service.find_by!(slug: "standard")
  express = Service.find_by!(slug: "express")
  bulky = Service.find_by!(slug: "fragile-bulky")

  base = {
    collection_contact_name: "Casey Customer", collection_phone: "07700 900123", collection_email: "customer@example.com",
    collection_line1: "10 Downing Street", collection_city: "London", collection_postcode: "SW1A 2AA",
    delivery_contact_name: "Jamie Recipient", delivery_phone: "07700 900456", delivery_email: "jamie@example.com",
    customer_email: "customer@example.com", user: customer
  }

  samples = [
    [standard, { delivery_line1: "1 Deansgate", delivery_city: "Manchester", delivery_postcode: "M3 1AZ", item_description: "Box of books", weight_kg: 8 }, %w[awaiting_payment booked collected in_transit out_for_delivery]],
    [express, { delivery_line1: "Princes Street", delivery_city: "Edinburgh", delivery_postcode: "EH2 2ER", item_description: "Laptop", weight_kg: 3, fragile: true }, %w[awaiting_payment booked collected in_transit]],
    [bulky, { delivery_line1: "12 Queen Street", delivery_city: "Cardiff", delivery_postcode: "CF10 2BU", item_description: "Oak sideboard", weight_kg: 60, length_cm: 160, width_cm: 45, height_cm: 80 }, %w[awaiting_payment booked collected in_transit out_for_delivery delivered]],
    [standard, { delivery_line1: "Donegall Square", delivery_city: "Belfast", delivery_postcode: "BT1 5GS", item_description: "Clothing parcel", weight_kg: 2 }, %w[awaiting_payment]],
    [standard, { delivery_line1: "5 Broad Street", delivery_city: "Birmingham", delivery_postcode: "B1 2HF", item_description: "Spare parts", quantity: 2 }, []],
    [express, { delivery_line1: "Harbour Road", delivery_city: "Inverness", delivery_postcode: "IV1 1SY", item_description: "Documents", weight_kg: 1 }, %w[awaiting_payment booked collected in_transit out_for_delivery failed_delivery]]
  ]

  samples.each_with_index do |(service, attrs, path), i|
    attrs = base.merge(attrs)
    quote = PriceCalculator.new(service:, lookup: false, **attrs.slice(:collection_postcode, :delivery_postcode, :quantity, :weight_kg, :length_cm, :width_cm, :height_cm, :fragile)).call
    booking = Booking.create!(attrs.merge(service:, estimated_price_pence: quote.total_pence,
                                          estimated_delivery_date: quote.estimated_delivery_date,
                                          price_breakdown: { lines: quote.lines, warnings: quote.warnings, chargeable_weight_kg: quote.chargeable_weight_kg },
                                          created_at: (i * 2 + 1).days.ago))
    booking.status_events.create!(status: "quote_requested", note: "Quote request received", created_at: booking.created_at)
    booking.update!(driver:) if path.include?("booked")
    path.each do |status|
      case status
      when "awaiting_payment" then booking.confirm_price!(quote.total_pence, user: ops)
      when "booked"
        PaymentProcessor.charge!(booking:, amount_pence: booking.confirmed_price_pence, card_number: "4242424242424242", expiry: "12/30", cvc: "123")
        booking.update!(payment_status: "paid")
        booking.transition_to!("booked", note: "Payment received")
      when "delivered"
        booking.create_proof_of_delivery!(recipient_name: "J. Recipient", notes: "Left with recipient", user: driver,
                                          signature_data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=")
        booking.transition_to!("delivered", user: driver, location: attrs[:delivery_city])
      when "failed_delivery"
        booking.transition_to!("failed_delivery", user: driver, note: "No one available to receive the parcel. Card left.")
      else
        booking.transition_to!(status, user: driver, location: status == "collected" ? "London" : nil)
      end
    end
  end

  Enquiry.create!(name: "Sam Smith", email: "sam@example.com", subject: "Can you deliver a piano?",
                  message: "I need an upright piano moved from Leeds to York next month. Is that something you can do?")
end

unless Rails.env.test?
  puts "Seeded: #{Service.count} services, #{DeliveryArea.count} areas, #{Booking.count} bookings, #{User.count} users"
  puts "Logins (#{Rails.env.production? ? "password from SEED_PASSWORD" : seed_password}): #{[admin, ops, driver, customer].map(&:email).join(', ')}"
end
