class CreatePostcodeRules < ActiveRecord::Migration[8.0]
  def change
    # Per-postcode-area exceptions to the normal UK service area. Areas without a rule are served normally.
    create_table :postcode_rules do |t|
      t.string :postcode_area, null: false
      t.string :level, null: false          # "outside" (not normally served) or "restricted" (rarely / case by case)
      t.string :note
      t.boolean :active, null: false, default: true
      t.timestamps
    end
    add_index :postcode_rules, :postcode_area, unique: true

    add_column :bookings, :area_review, :boolean, null: false, default: false
    add_column :bookings, :area_review_notes, :text
    add_index :bookings, :area_review
  end
end
