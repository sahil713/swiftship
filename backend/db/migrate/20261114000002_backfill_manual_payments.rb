class BackfillManualPayments < ActiveRecord::Migration[8.0]
  # Bookings marked Paid by hand (or automatically on Booked) before payments were recorded
  # for that: add a manual payment for the amount owed so the Payments list matches the status.
  def up
    Booking.reset_column_information
    Payment.reset_column_information
    Booking.where(payment_status: "paid").find_each do |booking|
      next if booking.payments.exists?
      amount = booking.price_pence.to_i
      next unless amount.positive?
      booking.payments.create!(amount_pence: amount, status: "succeeded", provider: "manual",
                               provider_reference: "Marked as paid", created_at: booking.booked_at || booking.updated_at)
    end
  end

  def down
    Payment.where(provider: "manual", provider_reference: "Marked as paid").delete_all
  end
end
