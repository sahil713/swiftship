class AdminMailer < ApplicationMailer
  helper_method :row

  def new_enquiry(booking, to:)
    @booking = booking
    @admin_url = "#{ENV.fetch('FRONTEND_ORIGIN', 'http://localhost:5173')}/admin/bookings/#{booking.reference}"
    mail(
      to:,
      reply_to: booking.customer_email,
      subject: "#{booking.area_review ? '[Area review] ' : ''}New quote request #{booking.reference} – #{booking.collection_postcode} → #{booking.delivery_postcode}"
    ) do |format|
      format.text
      format.html
    end
  end

  private

  def row(value) = value.presence || "—"
end
