# Sends customer email + SMS updates for important booking events and keeps a
# log in the notifications table. SMS is logged only until a provider (e.g.
# Twilio) is configured.
class BookingNotifier
  MESSAGES = {
    "quote_requested" => "We've received your quote request %{ref}. We'll confirm the final price shortly.",
    "awaiting_payment" => "Your price for %{ref} is confirmed at %{price}. Pay online to confirm your booking.",
    "booked" => "Booking %{ref} is confirmed. Track it with %{tn}.",
    "collected" => "Your shipment %{tn} has been collected.",
    "out_for_delivery" => "Your shipment %{tn} is out for delivery today.",
    "delivered" => "Your shipment %{tn} has been delivered.",
    "failed_delivery" => "We tried to deliver %{tn} but couldn't. We'll be in touch to rearrange.",
    "exception" => "There's an issue with shipment %{tn}. Our team is looking into it.",
    "cancelled" => "Booking %{ref} has been cancelled."
  }.freeze

  def self.status_changed(booking, note: nil)
    template = MESSAGES[booking.status] or return
    text = format(template, ref: booking.reference, tn: booking.tracking_number, price: Money.format(booking.price_pence))
    subject = "#{Booking.status_label(booking.status)} – #{booking.reference}"

    email_body = [text, note.presence, "Track your shipment: #{tracking_url(booking)}"].compact.join("\n\n")
    deliver_email(booking, booking.customer_email, subject, email_body)
    booking.notifications.create!(channel: "sms", recipient: booking.delivery_phone, body: "SwiftShip: #{text}", status: "logged") if sms_worthy?(booking.status)
  rescue StandardError => e
    Rails.logger.error("Notification failed for #{booking.reference}: #{e.message}")
  end

  def self.deliver_email(booking, to, subject, body)
    BookingMailer.update_email(to:, subject:, body:).deliver_now
    booking.notifications.create!(channel: "email", recipient: to, subject:, body:, status: "sent")
  rescue StandardError => e
    booking.notifications.create!(channel: "email", recipient: to, subject:, body:, status: "failed")
    Rails.logger.error("Email failed for #{booking.reference}: #{e.message}")
  end

  def self.sms_worthy?(status) = %w[booked out_for_delivery delivered failed_delivery exception].include?(status)

  def self.tracking_url(booking)
    "#{ENV.fetch('FRONTEND_ORIGIN', 'http://localhost:5173')}/track/#{booking.tracking_number}"
  end
end
