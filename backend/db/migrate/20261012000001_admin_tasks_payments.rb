class AdminTasksPayments < ActiveRecord::Migration[8.0]
  def change
    # Office-created tasks can be scheduled and carry instructions for the driver.
    add_column :driver_tasks, :scheduled_for, :datetime
    add_column :driver_tasks, :instructions, :text

    # Bookings created by the office can include a collection time.
    add_column :bookings, :collection_time, :string

    # The business's bank / payment details, reused when sending payment information to customers.
    create_table :payment_methods do |t|
      t.string :name, null: false            # e.g. "Business bank account"
      t.string :bank_name
      t.string :account_name
      t.string :account_number
      t.string :sort_code
      t.string :iban
      t.string :swift_bic
      t.text :instructions                   # e.g. "Use your booking reference as the payment reference"
      t.boolean :active, null: false, default: true
      t.integer :position, null: false, default: 0
      t.timestamps
    end
  end
end
