class ApplicationMailer < ActionMailer::Base
  BRAND_NAME = "Shift Logistics".freeze
  BRAND_FULL = "Shift Logistics — Powered by V&V Logistics and Rentals Ltd".freeze

  # Set MAIL_FROM to an address on your own domain once an email provider is configured.
  default from: ENV.fetch("MAIL_FROM", "Shift Logistics <no-reply@shiftlogistics.example>")
  layout "mailer"

  # False in production until an email provider is configured (SMTP_ADDRESS); mail is then
  # only recorded, so notification logs must not claim it was sent.
  def self.delivers? = !(Rails.env.production? && ActionMailer::Base.delivery_method == :test)
end
