class CreateCoreSchema < ActiveRecord::Migration[8.0]
  def change
    create_table :users do |t|
      t.string :name, null: false
      t.string :email, null: false
      t.string :phone
      t.string :password_digest, null: false
      t.string :role, null: false, default: "customer"
      t.boolean :active, null: false, default: true
      t.timestamps
    end
    add_index :users, "lower(email)", unique: true, name: "index_users_on_lower_email"
    add_index :users, :role

    create_table :addresses do |t|
      t.references :user, null: false, foreign_key: true
      t.string :label
      t.string :contact_name
      t.string :phone
      t.string :line1, null: false
      t.string :line2
      t.string :city, null: false
      t.string :postcode, null: false
      t.timestamps
    end

    create_table :services do |t|
      t.string :name, null: false
      t.string :slug, null: false
      t.string :tagline
      t.text :description
      t.string :transit_time
      t.integer :base_price_pence, null: false, default: 0
      t.integer :price_per_kg_pence, null: false, default: 0
      t.integer :included_kg, null: false, default: 0
      t.decimal :max_weight_kg, precision: 8, scale: 2
      t.integer :cutoff_hour
      t.text :restrictions
      t.integer :position, null: false, default: 0
      t.boolean :active, null: false, default: true
      t.timestamps
    end
    add_index :services, :slug, unique: true

    create_table :delivery_areas do |t|
      t.string :name, null: false
      t.string :zone, null: false, default: "mainland"
      t.string :postcode_areas, array: true, null: false, default: []
      t.integer :surcharge_pence, null: false, default: 0
      t.integer :extra_transit_days, null: false, default: 0
      t.boolean :serviced, null: false, default: true
      t.text :notes
      t.timestamps
    end
    add_index :delivery_areas, :postcode_areas, using: :gin

    create_table :surcharges do |t|
      t.string :name, null: false
      t.string :code, null: false
      t.string :kind, null: false, default: "fixed"
      t.integer :amount, null: false, default: 0
      t.text :description
      t.boolean :active, null: false, default: true
      t.timestamps
    end
    add_index :surcharges, :code, unique: true

    create_table :bookings do |t|
      t.string :reference, null: false
      t.string :tracking_number, null: false
      t.string :guest_token, null: false
      t.references :user, foreign_key: true
      t.references :service, null: false, foreign_key: true
      t.references :driver, foreign_key: { to_table: :users }
      t.string :status, null: false, default: "quote_requested"
      t.string :payment_status, null: false, default: "unpaid"

      t.string :collection_contact_name, null: false
      t.string :collection_phone, null: false
      t.string :collection_email, null: false
      t.string :collection_line1, null: false
      t.string :collection_line2
      t.string :collection_city, null: false
      t.string :collection_postcode, null: false

      t.string :delivery_contact_name, null: false
      t.string :delivery_phone, null: false
      t.string :delivery_email, null: false
      t.string :delivery_line1, null: false
      t.string :delivery_line2
      t.string :delivery_city, null: false
      t.string :delivery_postcode, null: false

      t.string :item_description, null: false
      t.integer :quantity, null: false, default: 1
      t.decimal :weight_kg, precision: 8, scale: 2
      t.decimal :length_cm, precision: 8, scale: 1
      t.decimal :width_cm, precision: 8, scale: 1
      t.decimal :height_cm, precision: 8, scale: 1
      t.boolean :fragile, null: false, default: false
      t.date :collection_date
      t.text :collection_instructions
      t.text :delivery_instructions

      t.integer :estimated_price_pence
      t.integer :confirmed_price_pence
      t.jsonb :price_breakdown, null: false, default: {}
      t.string :customer_email, null: false
      t.datetime :price_confirmed_at
      t.datetime :booked_at
      t.datetime :delivered_at
      t.date :estimated_delivery_date
      t.timestamps
    end
    add_index :bookings, :reference, unique: true
    add_index :bookings, :tracking_number, unique: true
    add_index :bookings, :status
    add_index :bookings, :customer_email

    create_table :status_events do |t|
      t.references :booking, null: false, foreign_key: true
      t.references :user, foreign_key: true
      t.string :status, null: false
      t.string :location
      t.text :note
      t.boolean :customer_visible, null: false, default: true
      t.datetime :created_at, null: false
    end

    create_table :booking_notes do |t|
      t.references :booking, null: false, foreign_key: true
      t.references :user, foreign_key: true
      t.string :kind, null: false, default: "internal"
      t.text :body, null: false
      t.timestamps
    end

    create_table :payments do |t|
      t.references :booking, null: false, foreign_key: true
      t.integer :amount_pence, null: false
      t.integer :refunded_pence, null: false, default: 0
      t.string :status, null: false, default: "pending"
      t.string :provider, null: false, default: "simulated"
      t.string :provider_reference
      t.string :card_last4
      t.string :card_brand
      t.timestamps
    end

    create_table :proof_of_deliveries do |t|
      t.references :booking, null: false, foreign_key: true, index: { unique: true }
      t.references :user, foreign_key: true
      t.string :recipient_name, null: false
      t.text :signature_data
      t.text :photo_data
      t.text :notes
      t.timestamps
    end

    create_table :change_requests do |t|
      t.references :booking, null: false, foreign_key: true
      t.references :user, foreign_key: true
      t.string :kind, null: false
      t.text :details
      t.string :status, null: false, default: "pending"
      t.text :admin_response
      t.timestamps
    end

    create_table :enquiries do |t|
      t.references :booking, foreign_key: true
      t.string :name, null: false
      t.string :email, null: false
      t.string :phone
      t.string :subject, null: false
      t.text :message, null: false
      t.string :status, null: false, default: "open"
      t.text :response
      t.timestamps
    end

    create_table :notifications do |t|
      t.references :booking, foreign_key: true
      t.string :channel, null: false
      t.string :recipient, null: false
      t.string :subject
      t.text :body, null: false
      t.string :status, null: false, default: "sent"
      t.timestamps
    end

    create_table :settings do |t|
      t.string :key, null: false
      t.jsonb :value
      t.timestamps
    end
    add_index :settings, :key, unique: true
  end
end
