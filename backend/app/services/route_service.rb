require "net/http"

# Road route between two points via OSRM (OpenStreetMap routing). Returns
# { coords: [[lat, lng], …], distance_m:, duration_s:, source: "osrm" }, or a straight-line
# estimate (source: "estimate") when the routing server can't be reached.
# OSRM's public server has no live traffic, so durations get a small allowance for a van.
module RouteService
  OSRM_URL = "https://router.project-osrm.org/route/v1/driving".freeze
  ENDPOINT = ENV.fetch("OSRM_URL", OSRM_URL)
  VAN_FACTOR = 1.15

  module_function

  def route(from_lat, from_lng, to_lat, to_lng)
    osrm(from_lat, from_lng, to_lat, to_lng) || estimate(from_lat, from_lng, to_lat, to_lng)
  end

  def osrm(from_lat, from_lng, to_lat, to_lng)
    return nil if Rails.env.test? || ENV["ROUTING"] == "off"

    uri = URI("#{ENDPOINT}/#{from_lng.to_f},#{from_lat.to_f};#{to_lng.to_f},#{to_lat.to_f}?overview=simplified&geometries=geojson")
    response = PlaceName.throttled do
      Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: 2, read_timeout: 4) do |http|
        http.get(uri.request_uri, "User-Agent" => PlaceName::USER_AGENT)
      end
    end
    return nil unless response.is_a?(Net::HTTPSuccess)

    best = JSON.parse(response.body)["routes"]&.first
    return nil unless best

    { coords: best.dig("geometry", "coordinates").map { |lng, lat| [lat.round(5), lng.round(5)] },
      distance_m: best["distance"].round, duration_s: (best["duration"] * VAN_FACTOR).round, source: "osrm" }
  rescue StandardError => e
    Rails.logger.warn("Routing failed: #{e.class}: #{e.message}")
    nil
  end

  def estimate(from_lat, from_lng, to_lat, to_lng)
    est = LiveEta.estimate(from_lat, from_lng, to_lat, to_lng)
    { coords: [[from_lat.to_f, from_lng.to_f], [to_lat.to_f, to_lng.to_f]], distance_m: (est[:distance_km] * 1000).round,
      duration_s: est[:eta_minutes] * 60, source: "estimate" }
  end
end
