class AddLiveLocationToDriverTasks < ActiveRecord::Migration[8.0]
  def change
    # Latest phone position while the driver is on the way to the delivery address,
    # shown to the customer on the public tracking page.
    change_table :driver_tasks, bulk: true do |t|
      t.decimal :live_latitude, precision: 10, scale: 6
      t.decimal :live_longitude, precision: 10, scale: 6
      t.integer :live_accuracy_m
      t.string :live_place
      t.datetime :live_located_at
    end
  end
end
