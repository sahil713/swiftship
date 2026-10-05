class DriverManagement < ActiveRecord::Migration[8.0]
  def change
    # Drivers can sign in with a username instead of an email address.
    add_column :users, :username, :string
    add_index :users, "lower(username)", unique: true, name: "index_users_on_lower_username", where: "username IS NOT NULL"
    change_column_null :users, :email, true

    # A task can be left without a driver (unassigned) until admin picks one.
    change_column_null :driver_tasks, :driver_id, true
  end
end
