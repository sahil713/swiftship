require "test_helper"

class BrevoDeliveryTest < ActiveSupport::TestCase
  setup { Rails.application.load_seed }

  test "builds Brevo's payload from a multipart enquiry email" do
    booking = Booking.first
    mail = AdminMailer.new_enquiry(booking, to: ["office@example.com"])
    payload = BrevoDelivery.payload(mail.message)

    assert_equal "Shift Logistics", payload[:sender][:name]
    assert_equal [{ email: "office@example.com" }], payload[:to]
    assert_equal({ email: booking.customer_email }, payload[:replyTo])
    assert_match booking.reference, payload[:subject]
    assert_includes payload[:htmlContent], booking.reference
    assert_includes payload[:textContent], booking.reference
  end

  test "builds a text-only payload for customer updates" do
    mail = BookingMailer.update_email(to: "c@example.com", subject: "Shift Logistics: Booked – X", body: "Your booking is confirmed.")
    payload = BrevoDelivery.payload(mail.message)
    assert_equal "Your booking is confirmed.", payload[:textContent]
    refute payload.key?(:htmlContent)
  end
end
