# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.0].define(version: 2026_10_06_000001) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "addresses", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "label"
    t.string "contact_name"
    t.string "phone"
    t.string "line1", null: false
    t.string "line2"
    t.string "city", null: false
    t.string "postcode", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_addresses_on_user_id"
  end

  create_table "booking_notes", force: :cascade do |t|
    t.bigint "booking_id", null: false
    t.bigint "user_id"
    t.string "kind", default: "internal", null: false
    t.text "body", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["booking_id"], name: "index_booking_notes_on_booking_id"
    t.index ["user_id"], name: "index_booking_notes_on_user_id"
  end

  create_table "bookings", force: :cascade do |t|
    t.string "reference", null: false
    t.string "tracking_number", null: false
    t.string "guest_token", null: false
    t.bigint "user_id"
    t.bigint "service_id", null: false
    t.bigint "driver_id"
    t.string "status", default: "quote_requested", null: false
    t.string "payment_status", default: "unpaid", null: false
    t.string "collection_contact_name", null: false
    t.string "collection_phone", null: false
    t.string "collection_email", null: false
    t.string "collection_line1", null: false
    t.string "collection_line2"
    t.string "collection_city", null: false
    t.string "collection_postcode", null: false
    t.string "delivery_contact_name", null: false
    t.string "delivery_phone", null: false
    t.string "delivery_email", null: false
    t.string "delivery_line1", null: false
    t.string "delivery_line2"
    t.string "delivery_city", null: false
    t.string "delivery_postcode", null: false
    t.string "item_description", null: false
    t.integer "quantity", default: 1, null: false
    t.decimal "weight_kg", precision: 8, scale: 2
    t.decimal "length_cm", precision: 8, scale: 1
    t.decimal "width_cm", precision: 8, scale: 1
    t.decimal "height_cm", precision: 8, scale: 1
    t.boolean "fragile", default: false, null: false
    t.date "collection_date"
    t.text "collection_instructions"
    t.text "delivery_instructions"
    t.integer "estimated_price_pence"
    t.integer "confirmed_price_pence"
    t.jsonb "price_breakdown", default: {}, null: false
    t.string "customer_email", null: false
    t.datetime "price_confirmed_at"
    t.datetime "booked_at"
    t.datetime "delivered_at"
    t.date "estimated_delivery_date"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.text "special_requirements"
    t.boolean "area_review", default: false, null: false
    t.text "area_review_notes"
    t.index ["area_review"], name: "index_bookings_on_area_review"
    t.index ["customer_email"], name: "index_bookings_on_customer_email"
    t.index ["driver_id"], name: "index_bookings_on_driver_id"
    t.index ["reference"], name: "index_bookings_on_reference", unique: true
    t.index ["service_id"], name: "index_bookings_on_service_id"
    t.index ["status"], name: "index_bookings_on_status"
    t.index ["tracking_number"], name: "index_bookings_on_tracking_number", unique: true
    t.index ["user_id"], name: "index_bookings_on_user_id"
  end

  create_table "change_requests", force: :cascade do |t|
    t.bigint "booking_id", null: false
    t.bigint "user_id"
    t.string "kind", null: false
    t.text "details"
    t.string "status", default: "pending", null: false
    t.text "admin_response"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["booking_id"], name: "index_change_requests_on_booking_id"
    t.index ["user_id"], name: "index_change_requests_on_user_id"
  end

  create_table "delivery_areas", force: :cascade do |t|
    t.string "name", null: false
    t.string "zone", default: "mainland", null: false
    t.string "postcode_areas", default: [], null: false, array: true
    t.integer "surcharge_pence", default: 0, null: false
    t.integer "extra_transit_days", default: 0, null: false
    t.boolean "serviced", default: true, null: false
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["postcode_areas"], name: "index_delivery_areas_on_postcode_areas", using: :gin
  end

  create_table "enquiries", force: :cascade do |t|
    t.bigint "booking_id"
    t.string "name", null: false
    t.string "email", null: false
    t.string "phone"
    t.string "subject", null: false
    t.text "message", null: false
    t.string "status", default: "open", null: false
    t.text "response"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["booking_id"], name: "index_enquiries_on_booking_id"
  end

  create_table "notifications", force: :cascade do |t|
    t.bigint "booking_id"
    t.string "channel", null: false
    t.string "recipient", null: false
    t.string "subject"
    t.text "body", null: false
    t.string "status", default: "sent", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["booking_id"], name: "index_notifications_on_booking_id"
  end

  create_table "payments", force: :cascade do |t|
    t.bigint "booking_id", null: false
    t.integer "amount_pence", null: false
    t.integer "refunded_pence", default: 0, null: false
    t.string "status", default: "pending", null: false
    t.string "provider", default: "simulated", null: false
    t.string "provider_reference"
    t.string "card_last4"
    t.string "card_brand"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["booking_id"], name: "index_payments_on_booking_id"
  end

  create_table "postcode_rules", force: :cascade do |t|
    t.string "postcode_area", null: false
    t.string "level", null: false
    t.string "note"
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["postcode_area"], name: "index_postcode_rules_on_postcode_area", unique: true
  end

  create_table "proof_of_deliveries", force: :cascade do |t|
    t.bigint "booking_id", null: false
    t.bigint "user_id"
    t.string "recipient_name", null: false
    t.text "signature_data"
    t.text "photo_data"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["booking_id"], name: "index_proof_of_deliveries_on_booking_id", unique: true
    t.index ["user_id"], name: "index_proof_of_deliveries_on_user_id"
  end

  create_table "services", force: :cascade do |t|
    t.string "name", null: false
    t.string "slug", null: false
    t.string "tagline"
    t.text "description"
    t.string "transit_time"
    t.integer "base_price_pence", default: 0, null: false
    t.integer "price_per_kg_pence", default: 0, null: false
    t.integer "included_kg", default: 0, null: false
    t.decimal "max_weight_kg", precision: 8, scale: 2
    t.integer "cutoff_hour"
    t.text "restrictions"
    t.integer "position", default: 0, null: false
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["slug"], name: "index_services_on_slug", unique: true
  end

  create_table "settings", force: :cascade do |t|
    t.string "key", null: false
    t.jsonb "value"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["key"], name: "index_settings_on_key", unique: true
  end

  create_table "status_events", force: :cascade do |t|
    t.bigint "booking_id", null: false
    t.bigint "user_id"
    t.string "status", null: false
    t.string "location"
    t.text "note"
    t.boolean "customer_visible", default: true, null: false
    t.datetime "created_at", null: false
    t.index ["booking_id"], name: "index_status_events_on_booking_id"
    t.index ["user_id"], name: "index_status_events_on_user_id"
  end

  create_table "surcharges", force: :cascade do |t|
    t.string "name", null: false
    t.string "code", null: false
    t.string "kind", default: "fixed", null: false
    t.integer "amount", default: 0, null: false
    t.text "description"
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["code"], name: "index_surcharges_on_code", unique: true
  end

  create_table "users", force: :cascade do |t|
    t.string "name", null: false
    t.string "email", null: false
    t.string "phone"
    t.string "password_digest", null: false
    t.string "role", default: "customer", null: false
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index "lower((email)::text)", name: "index_users_on_lower_email", unique: true
    t.index ["role"], name: "index_users_on_role"
  end

  add_foreign_key "addresses", "users"
  add_foreign_key "booking_notes", "bookings"
  add_foreign_key "booking_notes", "users"
  add_foreign_key "bookings", "services"
  add_foreign_key "bookings", "users"
  add_foreign_key "bookings", "users", column: "driver_id"
  add_foreign_key "change_requests", "bookings"
  add_foreign_key "change_requests", "users"
  add_foreign_key "enquiries", "bookings"
  add_foreign_key "notifications", "bookings"
  add_foreign_key "payments", "bookings"
  add_foreign_key "proof_of_deliveries", "bookings"
  add_foreign_key "proof_of_deliveries", "users"
  add_foreign_key "status_events", "bookings"
  add_foreign_key "status_events", "users"
end
