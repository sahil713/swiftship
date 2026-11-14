require "net/http"

# Street-level place names, e.g. "Tunnard Street, Witham, Boston" or "Victoria Avenue, Bishopsgate, London".
# Street and town come from OpenStreetMap (Nominatim reverse geocoding); the area is the
# postcodes.io ward. Falls back to "ward, district" when OpenStreetMap can't be reached.
# Nominatim allows at most 1 request a second, so calls are spaced out and results cached.
module PlaceName
  NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse".freeze
  USER_AGENT = "ShiftLogistics/1.0".freeze
  MIN_INTERVAL = 1.1 # seconds between Nominatim requests
  @lock = Mutex.new
  @last_request_at = 0.0

  module_function

  # region/district/ward: from postcodes.io, used for the town and area and as a fallback.
  def for_point(lat, lng, ward: nil, district: nil, region: nil, precision: 4)
    return nil if lat.nil? || lng.nil?
    return fallback(ward, district) if Rails.env.test? || ENV["POSTCODE_LOOKUP"] == "off"

    key = "place-name/v1/#{lat.to_f.round(precision)},#{lng.to_f.round(precision)}"
    osm = Rails.cache.fetch(key, expires_in: 30.days, skip_nil: true) { reverse(lat, lng) }
    return fallback(ward, district) unless osm

    town = region.to_s.casecmp?("London") ? "London" : (osm[:town] || district)
    area = ward unless ward.to_s.casecmp?(town.to_s) || ward.to_s.casecmp?(osm[:street].to_s)
    [osm[:street], area, town].compact_blank.uniq.join(", ").presence || fallback(ward, district)
  end

  def fallback(ward, district)
    [ward, district].compact_blank.uniq.join(", ").presence
  end

  def reverse(lat, lng)
    uri = URI("#{NOMINATIM_URL}?lat=#{lat.to_f}&lon=#{lng.to_f}&format=jsonv2&zoom=17&addressdetails=1")
    response = throttled do
      Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 2, read_timeout: 3) do |http|
        http.get(uri.request_uri, "User-Agent" => USER_AGENT, "Accept-Language" => "en-GB")
      end
    end
    return nil unless response.is_a?(Net::HTTPSuccess)

    address = JSON.parse(response.body)["address"] || {}
    street = address["road"] || address["pedestrian"] || address["square"]
    town = address["town"] || address["city"] || address["village"] || address["hamlet"]
    street || town ? { street:, town: } : nil
  rescue StandardError => e
    Rails.logger.warn("Street lookup failed: #{e.class}: #{e.message}")
    nil
  end

  def throttled
    @lock.synchronize do
      wait = MIN_INTERVAL - (Process.clock_gettime(Process::CLOCK_MONOTONIC) - @last_request_at)
      sleep(wait) if wait.positive?
      @last_request_at = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    end
    yield
  end
end
