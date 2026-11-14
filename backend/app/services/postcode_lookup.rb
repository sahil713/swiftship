require "net/http"

# Confirms a postcode actually exists using the free postcodes.io API.
# Falls back to format-only validation when the API is unreachable, so the
# service keeps working offline.
class PostcodeLookup
  Result = Struct.new(:exists, :verified, :country, :region, :district, :ward, :place, :latitude, :longitude, keyword_init: true)

  BASE_URL = "https://api.postcodes.io/postcodes/".freeze

  def self.call(postcode)
    formatted = UkPostcode.format(postcode)
    return Result.new(exists: false, verified: true) unless formatted
    return Result.new(exists: true, verified: false) if Rails.env.test? || ENV["POSTCODE_LOOKUP"] == "off"

    key = "postcode-lookup/v3/#{formatted}"
    cached = Rails.cache.read(key)
    return cached if cached

    result = fetch(formatted)
    Rails.cache.write(key, result, expires_in: 1.day) if result.verified # don't cache network failures
    result
  end

  def self.fetch(formatted)
    uri = URI("#{BASE_URL}#{formatted.delete(" ")}")
    response = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 2, read_timeout: 3) do |http|
      http.get(uri.request_uri)
    end
    case response
    when Net::HTTPSuccess
      data = JSON.parse(response.body).fetch("result", {})
      place = PlaceName.for_point(data["latitude"], data["longitude"], ward: data["admin_ward"], district: data["admin_district"], region: data["region"])
      Result.new(exists: true, verified: true, country: data["country"], region: data["region"], district: data["admin_district"],
                 ward: data["admin_ward"], place:, latitude: data["latitude"], longitude: data["longitude"])
    when Net::HTTPNotFound
      Result.new(exists: false, verified: true)
    else
      Result.new(exists: true, verified: false)
    end
  rescue StandardError => e
    Rails.logger.warn("Postcode lookup failed for #{formatted}: #{e.class}: #{e.message}")
    Result.new(exists: true, verified: false)
  end
end
