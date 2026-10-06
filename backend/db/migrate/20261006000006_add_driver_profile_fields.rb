class AddDriverProfileFields < ActiveRecord::Migration[8.0]
  def up
    change_table :users, bulk: true do |t|
      t.string :first_name
      t.string :last_name
      t.string :licence_number        # encrypted
      t.string :transmission          # manual | automatic
      t.string :passport_number       # encrypted, optional
      t.string :visa_status           # optional
      t.date :visa_expiry             # optional
      t.string :bank_account_name     # optional
      t.string :bank_sort_code        # encrypted, optional
      t.string :bank_account_number   # encrypted, optional
    end

    # Split existing drivers' full names into first/last.
    execute <<~SQL
      UPDATE users
      SET first_name = split_part(name, ' ', 1),
          last_name = NULLIF(regexp_replace(name, '^\\S+\\s*', ''), '')
      WHERE role = 'driver'
    SQL
  end

  def down
    change_table :users, bulk: true do |t|
      t.remove :first_name, :last_name, :licence_number, :transmission, :passport_number, :visa_status,
               :visa_expiry, :bank_account_name, :bank_sort_code, :bank_account_number
    end
  end
end
