class TaskStepsAndEvents < ActiveRecord::Migration[8.0]
  def change
    # Arrival timestamps so each stage of a task can be timed.
    add_column :driver_tasks, :arrived_at, :datetime
    add_column :driver_tasks, :arrived_delivery_at, :datetime

    # A task can now hold several proofs: collection (POC), depot, delivery (POD).
    remove_index :task_proofs, :driver_task_id
    add_index :task_proofs, %i[driver_task_id kind], unique: true

    # Audit trail of every action on a task, by the driver or the office.
    create_table :task_events do |t|
      t.references :driver_task, null: false, foreign_key: true
      t.references :user, foreign_key: true
      t.string :action, null: false
      t.text :note
      t.datetime :occurred_at, null: false
      t.timestamps
    end
  end
end
