class AddEmailStatusToEnquiries < ActiveRecord::Migration[8.0]
  def change
    # Whether the admin alert email for a contact-form message was sent.
    add_column :enquiries, :email_status, :string
  end
end
