require "net/http"

# ActionMailer delivery method that sends through Brevo's HTTPS email API.
# Used in production because the hosting plan blocks outgoing SMTP ports.
class BrevoDelivery
  ENDPOINT = URI("https://api.brevo.com/v3/smtp/email").freeze

  class Error < StandardError; end

  attr_accessor :settings

  def initialize(settings)
    @settings = settings
  end

  def deliver!(mail)
    response = Net::HTTP.start(ENDPOINT.host, ENDPOINT.port, use_ssl: true, open_timeout: 5, read_timeout: 10) do |http|
      request = Net::HTTP::Post.new(ENDPOINT, "api-key" => settings.fetch(:api_key), "Content-Type" => "application/json", "Accept" => "application/json")
      request.body = JSON.generate(self.class.payload(mail))
      http.request(request)
    end
    raise Error, "Brevo rejected the email (#{response.code}): #{response.body.to_s[0, 300]}" unless response.is_a?(Net::HTTPSuccess)
    response
  end

  # Converts a Mail::Message into Brevo's JSON format.
  def self.payload(mail)
    from = mail[:from].addrs.first
    body = {
      sender: { name: from.display_name.presence || ApplicationMailer::BRAND_NAME, email: from.address },
      to: Array(mail.to).map { { email: _1 } },
      subject: mail.subject
    }
    body[:replyTo] = { email: mail.reply_to.first } if mail.reply_to.present?

    if mail.multipart?
      body[:htmlContent] = mail.html_part&.decoded
      body[:textContent] = mail.text_part&.decoded
    elsif mail.mime_type == "text/html"
      body[:htmlContent] = mail.decoded
    else
      body[:textContent] = mail.decoded
    end
    body.compact
  end
end
