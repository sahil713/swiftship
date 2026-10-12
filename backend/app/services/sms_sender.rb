require "net/http"

# Sends text messages through Brevo's transactional SMS API (the same Brevo account used for email).
# Brevo only sends SMS once the account has SMS credits, so #available? checks that first –
# nothing is pretended: when SMS isn't available the caller gets NotAvailable.
class SmsSender
  class NotAvailable < StandardError; end
  class Error < StandardError; end

  ENDPOINT = URI("https://api.brevo.com/v3/transactionalSMS/sms").freeze
  SENDER = "ShiftLogs" # alphanumeric sender ID shown on the phone (max 11 characters)

  def self.api_key = ENV["BREVO_API_KEY"].presence

  # True when Brevo is configured and the account holds SMS credits (cached for 10 minutes).
  def self.available?
    return false unless api_key
    Rails.cache.fetch("brevo-sms-credits", expires_in: 10.minutes) do
      account = request(Net::HTTP::Get, URI("https://api.brevo.com/v3/account"))
      Array(account["plan"]).any? { _1["type"].to_s == "sms" && _1["credits"].to_f.positive? }
    rescue StandardError => e
      Rails.logger.warn("Brevo SMS credit check failed: #{e.message}")
      false
    end
  end

  # UK mobile numbers to international digits, e.g. "07700 900123" → "447700900123".
  def self.normalize(phone)
    digits = phone.to_s.gsub(/[^\d+]/, "")
    digits = digits.sub(/\A\+/, "")
    digits = "44#{digits[1..]}" if digits.start_with?("0")
    digits.match?(/\A\d{10,15}\z/) ? digits : nil
  end

  def self.deliver!(to:, body:)
    raise NotAvailable, "Text messages aren't set up yet – add SMS credits to the Brevo account to enable them" unless available?
    recipient = normalize(to) or raise Error, "#{to} isn't a valid mobile number"
    request(Net::HTTP::Post, ENDPOINT, { sender: SENDER, recipient:, content: body.to_s[0, 640], type: "transactional" })
  end

  def self.request(klass, uri, body = nil)
    response = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 5, read_timeout: 10) do |http|
      req = klass.new(uri, "api-key" => api_key, "Content-Type" => "application/json", "Accept" => "application/json")
      req.body = JSON.generate(body) if body
      http.request(req)
    end
    raise Error, "Brevo SMS error (#{response.code}): #{response.body.to_s[0, 200]}" unless response.is_a?(Net::HTTPSuccess)
    JSON.parse(response.body.presence || "{}")
  end
end
