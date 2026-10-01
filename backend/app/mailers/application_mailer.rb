class ApplicationMailer < ActionMailer::Base
  default from: "SwiftShip <no-reply@swiftship.example>"
  layout "mailer"

  # False in production until an email provider is configured (SMTP_ADDRESS); mail is then
  # only recorded, so notification logs must not claim it was sent.
  def self.delivers? = !(Rails.env.production? && ActionMailer::Base.delivery_method == :test)
end
