class CustomerMailer < ApplicationMailer
  # Payment details for a booking, using a saved payment method.
  def payment_details(booking, payment_method, to:, amount_pence:, message:)
    @booking, @method, @amount_pence, @message = booking, payment_method, amount_pence, message
    @customer_name = booking.user&.name || booking.collection_contact_name
    mail(to:, reply_to: support_email, subject: "#{BRAND_NAME}: payment details for booking #{booking.reference}") do |format|
      format.text
      format.html
    end
  end

  # A message from the driver to the customer about their collection or delivery.
  def driver_message(booking, to:, contact_name:, driver_name:, body:)
    @booking, @contact_name, @driver_name, @body = booking, contact_name, driver_name, body
    mail(to:, reply_to: support_email, subject: "#{BRAND_NAME}: message from your driver about #{booking.reference}") do |format|
      format.text
      format.html
    end
  end

  private

  def support_email = Setting.get(:support_email).presence
end
