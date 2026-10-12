# Sends messages to a booking's customer by email (Brevo) and/or text (Brevo SMS when available),
# recording every attempt in the booking's notifications.
class CustomerMessenger
  Result = Struct.new(:channel, :recipient, :status, :error, keyword_init: true) do
    def as_json(*) = to_h
  end

  # channels: subset of %w[email sms]; returns one Result per channel.
  def self.deliver(booking, channels:, email_to:, phone_to:, subject:, email:, sms_text:)
    channels.map do |channel|
      to = channel == "email" ? email_to : phone_to
      next Result.new(channel:, recipient: to, status: "failed", error: "No #{channel == 'email' ? 'email address' : 'phone number'} on the booking") if to.blank?

      status, error =
        begin
          if channel == "email"
            email.call(to).deliver_now
            [ApplicationMailer.delivers? ? "sent" : "not_sent", nil]
          else
            SmsSender.deliver!(to:, body: sms_text)
            ["sent", nil]
          end
        rescue SmsSender::NotAvailable => e
          ["not_sent", e.message]
        rescue StandardError => e
          Rails.logger.error("#{channel} to #{to} failed for #{booking.reference}: #{e.class}: #{e.message}")
          ["failed", e.message]
        end
      booking.notifications.create!(channel:, recipient: to, subject: (subject if channel == "email"),
                                    body: channel == "email" ? "#{subject}\n\n#{sms_text}" : sms_text, status:)
      Result.new(channel:, recipient: to, status:, error:)
    end
  end
end
