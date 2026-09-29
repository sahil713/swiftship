# Decides whether a postcode is inside the UK delivery area.
class ServiceArea
  Result = Struct.new(:ok, :postcode, :area, :delivery_area, :message, :verified, :district, keyword_init: true) do
    def as_json(*)
      {
        ok:, postcode:, area:, message:, verified:, district:,
        zone: delivery_area&.zone, region: delivery_area&.name,
        surcharge_pence: delivery_area&.surcharge_pence.to_i,
        extra_transit_days: delivery_area&.extra_transit_days.to_i
      }
    end
  end

  NOT_UK_AREAS = {
    "GY" => "Guernsey is a Crown Dependency and is outside our UK service area.",
    "JE" => "Jersey is a Crown Dependency and is outside our UK service area.",
    "IM" => "The Isle of Man is a Crown Dependency and is outside our UK service area."
  }.freeze

  def self.check(raw, lookup: true)
    if raw.to_s.strip.empty?
      return Result.new(ok: false, message: "Enter a postcode.")
    end
    if UkPostcode.eircode?(raw) && !UkPostcode.valid?(raw)
      return Result.new(ok: false, message: "That looks like an Irish Eircode. We don't deliver to or from the Republic of Ireland.")
    end

    postcode = UkPostcode.format(raw)
    return Result.new(ok: false, message: "Enter a valid UK postcode, for example SW1A 1AA.") unless postcode

    area = UkPostcode.area(postcode)
    if NOT_UK_AREAS.key?(area)
      return Result.new(ok: false, postcode:, area:, message: NOT_UK_AREAS[area])
    end

    delivery_area = DeliveryArea.for_postcode_area(area)
    if delivery_area.nil? || !delivery_area.serviced
      return Result.new(ok: false, postcode:, area:, delivery_area:,
                        message: "Sorry, #{postcode} is outside our service area.")
    end
    if delivery_area.zone == "northern_ireland" && !Setting.get(:northern_ireland_enabled)
      return Result.new(ok: false, postcode:, area:, delivery_area:,
                        message: "We are not currently delivering to or from Northern Ireland.")
    end

    lookup_result = lookup ? PostcodeLookup.call(postcode) : nil
    if lookup_result && lookup_result.verified && !lookup_result.exists
      return Result.new(ok: false, postcode:, area:, delivery_area:, verified: true,
                        message: "We couldn't find #{postcode}. Please check it and try again.")
    end

    Result.new(ok: true, postcode:, area:, delivery_area:, verified: lookup_result&.verified || false,
               district: lookup_result&.district, message: "#{postcode} is in our #{delivery_area.name} area.")
  end
end
