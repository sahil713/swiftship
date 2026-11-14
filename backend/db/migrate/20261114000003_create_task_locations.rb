class CreateTaskLocations < ActiveRecord::Migration[8.0]
  def change
    # Breadcrumb trail of the driver's phone while a task is in progress (start → close),
    # drawn as the path travelled on the customer's tracking map.
    create_table :task_locations do |t|
      t.references :driver_task, null: false, foreign_key: true
      t.decimal :latitude, precision: 10, scale: 6, null: false
      t.decimal :longitude, precision: 10, scale: 6, null: false
      t.integer :accuracy_m
      t.datetime :recorded_at, null: false
    end
    add_index :task_locations, %i[driver_task_id recorded_at]

    # Latest road route from the driver to the next address: { dest, coords, distance_m, duration_s, source, computed_at, from }.
    add_column :driver_tasks, :live_route, :jsonb
  end
end
