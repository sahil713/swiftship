# Decides whether a postcode is inside the UK service area.
#
# Outcomes:
#   * blocked  – ok: false. Ireland (Republic and Northern Ireland), non-UK islands,
#                invalid/unknown postcodes and regions an admin has switched off.
#   * review   – ok: true, review: true. Areas we don't normally serve or serve only
#                occasionally. The customer can still submit; the request is flagged
#                so staff review it before quoting.
#   * normal   – ok: true. Everything else in the UK.
class ServiceArea
  Result = Struct.new(:ok, :postcode, :area, :delivery_area, :message, :verified, :district,
                      :review, :review_level, :review_reason, keyword_init: true) do
    def as_json(*)
      {
        ok:, postcode:, area:, message:, verified:, district:,
        review: review || false, review_level:, review_reason:,
        zone: delivery_area&.zone, region: delivery_area&.name,
        surcharge_pence: delivery_area&.surcharge_pence.to_i,
        extra_transit_days: delivery_area&.extra_transit_days.to_i
      }
    end
  end

  IRELAND_MESSAGE = "We don't provide services to or from Ireland – this includes the Republic of Ireland and Northern Ireland.".freeze
  IRELAND_AREAS = %w[BT].freeze

  NOT_UK_AREAS = {
    "GY" => "Guernsey is a Crown Dependency and is outside our UK service area.",
    "JE" => "Jersey is a Crown Dependency and is outside our UK service area.",
    "IM" => "The Isle of Man is a Crown Dependency and is outside our UK service area."
  }.freeze

  # Scottish postcodes north of this latitude count as "north of Glasgow". It sits just
  # beyond Glasgow's northern edge (Milngavie, Kirkintilloch, Cumbernauld ≈ 55.95°N),
  # so Glasgow and Edinburgh remain normal service areas.
  SCOTLAND_NORTH_LIMIT = 55.98
  # Areas that straddle that line. If the exact location can't be looked up, flag them
  # for review rather than guessing.
  SCOTLAND_BORDERLINE_AREAS = %w[FK KY PA].freeze

  def self.check(raw, lookup: true)
    return Result.new(ok: false, message: "Enter a postcode.") if raw.to_s.strip.empty?
    if UkPostcode.eircode?(raw) && !UkPostcode.valid?(raw)
      return Result.new(ok: false, message: "That looks like an Irish Eircode. #{IRELAND_MESSAGE}")
    end

    postcode = UkPostcode.format(raw)
    return Result.new(ok: false, message: "Enter a valid UK postcode, for example SW1A 1AA.") unless postcode

    area = UkPostcode.area(postcode)
    return Result.new(ok: false, postcode:, area:, message: IRELAND_MESSAGE) if IRELAND_AREAS.include?(area)
    return Result.new(ok: false, postcode:, area:, message: NOT_UK_AREAS[area]) if NOT_UK_AREAS.key?(area)

    delivery_area = DeliveryArea.for_postcode_area(area)
    if delivery_area.nil? || !delivery_area.serviced
      return Result.new(ok: false, postcode:, area:, delivery_area:, message: "Sorry, #{postcode} is outside our service area.")
    end

    found = lookup ? PostcodeLookup.call(postcode) : nil
    if found&.verified && !found.exists
      return Result.new(ok: false, postcode:, area:, delivery_area:, verified: true,
                        message: "We couldn't find #{postcode}. Please check it and try again.")
    end
    if found&.verified && found.country.to_s.casecmp?("Northern Ireland")
      return Result.new(ok: false, postcode:, area:, message: IRELAND_MESSAGE)
    end

    base = { ok: true, postcode:, area:, delivery_area:, verified: found&.verified || false, district: found&.district }
    level, reason = review_for(area, found)
    if level
      Result.new(**base, review: true, review_level: level, review_reason: reason,
                 message: "#{postcode} is #{level == 'outside' ? 'outside our normal service area' : 'in an area we only serve occasionally'}. " \
                          "You can still send your request – our team will review it and call you.")
    else
      Result.new(**base, review: false, message: "#{postcode} is in our #{delivery_area.name} area.")
    end
  end

  # Human-readable review notes for a request, e.g. "Delivery TQ1 1AA: Outside our normal…".
  def self.review_notes(collection:, delivery:)
    { "Collection" => collection, "Delivery" => delivery }
      .select { |_, check| check&.review }
      .map { |label, check| "#{label} #{check.postcode}: #{check.review_reason}" }
  end

  # Returns [level, reason] when a postcode needs admin review, or nil for a normal area.
  def self.review_for(area, found)
    if (rule = PostcodeRule.for_area(area))
      return [rule.level, rule.note.presence || PostcodeRule::LEVEL_LABELS[rule.level]]
    end

    latitude = found&.latitude
    scottish = found&.country.to_s.casecmp?("Scotland")
    if scottish && latitude && latitude > SCOTLAND_NORTH_LIMIT
      return ["outside", "North of Glasgow – outside our normal Scottish service area"]
    end
    if latitude.nil? && SCOTLAND_BORDERLINE_AREAS.include?(area)
      return ["restricted", "May be north of Glasgow – exact location needs checking"]
    end

    nil
  end
end
