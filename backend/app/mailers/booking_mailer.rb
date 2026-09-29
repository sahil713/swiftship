class BookingMailer < ApplicationMailer
  def update_email(to:, subject:, body:)
    mail(to:, subject:) { |format| format.text { render plain: body } }
  end
end
