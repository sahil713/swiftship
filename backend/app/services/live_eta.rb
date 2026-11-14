require "net/http"

# Estimates how far the driver is from the delivery address and when they'll arrive.
# Straight-line distance × a road factor, at an average speed that rises with distance
# (town driving for short hops, A-roads/motorways for longer runs). An estimate, not routing.
module LiveEta
  ROAD_FACTOR = 1.3
  EARTH_RADIUS_KM = 6371.0
  KM_PER_MILE = 1.609344

  module_function

  def estimate(from_lat, from_lng, to_lat, to_lng)
    road_km = haversine_km(from_lat, from_lng, to_lat, to_lng) * ROAD_FACTOR
    speed_kmh = if road_km < 8 then 25 elsif road_km < 40 then 45 else 70 end
    minutes = [(road_km / speed_kmh * 60).ceil, 1].max
    { distance_km: road_km.round(1), distance_miles: (road_km / KM_PER_MILE).round(1), eta_minutes: minutes }
  end

  def haversine_km(lat1, lng1, lat2, lng2)
    rad = ->(d) { d.to_f * Math::PI / 180 }
    dlat = rad.(lat2 - lat1)
    dlng = rad.(lng2 - lng1)
    a = Math.sin(dlat / 2)**2 + Math.cos(rad.(lat1)) * Math.cos(rad.(lat2)) * Math.sin(dlng / 2)**2
    2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a))
  end

  # Nearest street and town to a GPS point, e.g. "Tunnard Street, Witham, Boston". nil when unknown or offline.
  def place_name(lat, lng)
    return nil if Rails.env.test? || ENV["POSTCODE_LOOKUP"] == "off"

    area = Rails.cache.fetch("live-area/v1/#{lat.to_f.round(3)},#{lng.to_f.round(3)}", expires_in: 1.day, skip_nil: true) do
      uri = URI("https://api.postcodes.io/postcodes?lon=#{lng.to_f}&lat=#{lat.to_f}&limit=1&radius=2000")
      response = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 2, read_timeout: 3) { _1.get(uri.request_uri) }
      result = response.is_a?(Net::HTTPSuccess) ? Array(JSON.parse(response.body)["result"]).first : nil
      result&.slice("admin_ward", "admin_district", "region")
    end || {}
    PlaceName.for_point(lat, lng, ward: area["admin_ward"], district: area["admin_district"], region: area["region"], precision: 3)
  rescue StandardError => e
    Rails.logger.warn("Reverse geocode failed: #{e.class}: #{e.message}")
    nil
  end
end
