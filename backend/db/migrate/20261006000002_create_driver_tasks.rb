class CreateDriverTasks < ActiveRecord::Migration[8.0]
  def change
    # A job is split into a collection task and a delivery task, each assigned to a driver.
    create_table :driver_tasks do |t|
      t.references :booking, null: false, foreign_key: true
      t.references :driver, null: false, foreign_key: { to_table: :users }
      t.string :kind, null: false                       # collection | delivery
      t.string :status, null: false, default: "assigned"
      t.text :warehouse_note
      t.datetime :started_at
      t.datetime :collected_at
      t.datetime :closed_at
      t.datetime :completed_at
      t.timestamps
    end
    add_index :driver_tasks, %i[booking_id kind]
    add_index :driver_tasks, %i[driver_id status]

    # Proof of Collection (POC) or Proof of Delivery (POD) recorded by the driver.
    create_table :task_proofs do |t|
      t.references :driver_task, null: false, foreign_key: true, index: { unique: true }
      t.references :user, foreign_key: true
      t.string :kind, null: false                       # collection | delivery
      t.string :person_name, null: false                # handed over by / received by
      t.datetime :occurred_at, null: false
      t.text :notes
      t.text :signature_data
      t.jsonb :photos, null: false, default: []         # data URLs (JPEG/PNG/WebP)
      t.timestamps
    end
  end
end
