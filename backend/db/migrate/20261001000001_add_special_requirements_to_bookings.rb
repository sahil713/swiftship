class AddSpecialRequirementsToBookings < ActiveRecord::Migration[8.0]
  def change
    add_column :bookings, :special_requirements, :text
  end
end
