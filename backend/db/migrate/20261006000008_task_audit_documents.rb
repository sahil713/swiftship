class TaskAuditDocuments < ActiveRecord::Migration[8.0]
  def change
    # Separate "Delivery Completed" and "At depot" moments from "Task Closed", for timing.
    add_column :driver_tasks, :delivered_at, :datetime
    add_column :driver_tasks, :at_depot_at, :datetime

    # Where each action happened: the phone's GPS position when the driver allowed it.
    add_column :task_events, :latitude, :decimal, precision: 10, scale: 6
    add_column :task_events, :longitude, :decimal, precision: 10, scale: 6
    add_column :task_events, :accuracy_m, :integer

    # Location recorded with a proof (e.g. depot name/address, or the stop's address).
    add_column :task_proofs, :location, :string

    # Corrections and edits to recorded data: original and new values, who, when and why.
    create_table :audit_logs do |t|
      t.references :auditable, polymorphic: true, null: false
      t.references :user, foreign_key: true
      t.string :action, null: false
      t.jsonb :changes_made, null: false, default: {}
      t.text :reason
      t.datetime :created_at, null: false
    end
    add_index :audit_logs, %i[auditable_type auditable_id created_at]

    # Driver documents (licence, passport, visa…), stored privately in the database.
    create_table :driver_documents do |t|
      t.references :user, null: false, foreign_key: true
      t.references :uploaded_by, foreign_key: { to_table: :users }
      t.string :doc_type, null: false
      t.string :filename, null: false
      t.string :content_type, null: false
      t.integer :byte_size, null: false
      t.binary :data, null: false
      t.date :expires_on
      t.text :notes
      t.datetime :replaced_at                     # set when a newer upload of the same type supersedes it
      t.references :replaced_by, foreign_key: { to_table: :users }
      t.timestamps
    end
    add_index :driver_documents, %i[user_id doc_type replaced_at]
  end
end
