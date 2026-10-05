# Builds an itemised price estimate for a shipment.
#
#   base service price
# + weight above the service's included allowance (chargeable = max(actual, volumetric))
# + inter-region route charge when collection and delivery are in different regions
# + area surcharges (remote / Northern Ireland) for both ends
# + fragile, bulky, weekend-collection surcharges
class PriceCalculator
  VOLUMETRIC_DIVISOR = 5000.0 # cm³ per kg, industry standard for road freight
  BULKY_DIMENSION_CM = 120
  BULKY_WEIGHT_KG = 30
  ASSUMED_WEIGHT_KG = 2.0

  Result = Struct.new(:ok, :errors, :warnings, :lines, :total_pence, :chargeable_weight_kg,
                      :estimated_delivery_date, :needs_review, :collection, :delivery, keyword_init: true) do
    def as_json(*)
      {
        ok:, errors:, warnings:, lines:, total_pence:, chargeable_weight_kg:,
        estimated_delivery_date:, needs_review:,
        collection: collection&.as_json, delivery: delivery&.as_json
      }
    end
  end

  def initialize(service:, collection_postcode:, delivery_postcode:, quantity: 1, weight_kg: nil,
                 length_cm: nil, width_cm: nil, height_cm: nil, fragile: false, collection_date: nil, lookup: true)
    @service = service
    @collection_postcode = collection_postcode
    @delivery_postcode = delivery_postcode
    @quantity = [quantity.to_i, 1].max
    @weight_kg = positive(weight_kg)
    @dims = [length_cm, width_cm, height_cm].map { positive(_1) }
    @fragile = ActiveModel::Type::Boolean.new.cast(fragile) || false
    @collection_date = parse_date(collection_date)
    @lookup = lookup
  end

  def call
    errors = []
    warnings = []
    errors << "Choose a service." unless @service&.active?

    collection = ServiceArea.check(@collection_postcode, lookup: @lookup)
    delivery = ServiceArea.check(@delivery_postcode, lookup: @lookup)
    errors << "Collection: #{collection.message}" unless collection.ok
    errors << "Delivery: #{delivery.message}" unless delivery.ok

    if errors.any?
      return Result.new(ok: false, errors:, warnings:, lines: [], total_pence: nil, collection:, delivery:)
    end

    needs_review = false
    review_notes = ServiceArea.review_notes(collection:, delivery:)
    if review_notes.any?
      needs_review = true
      warnings << "Outside our normal service area – our team will review your request before confirming a price."
    end
    lines = []
    lines << line("#{@service.name} delivery", @service.base_price_pence)

    chargeable = chargeable_weight(warnings)
    if @service.max_weight_kg && chargeable > @service.max_weight_kg * @quantity
      warnings << "Chargeable weight exceeds the #{@service.name} limit of #{@service.max_weight_kg.to_f} kg per item – our team will review your quote."
      needs_review = true
    end
    extra_kg = [chargeable - @service.included_kg * @quantity, 0].max
    if extra_kg.positive?
      lines << line("Weight: #{fmt_kg(extra_kg)} kg above #{@service.included_kg * @quantity} kg allowance",
                    (extra_kg.ceil * @service.price_per_kg_pence))
    end
    if @quantity > 1
      lines << line("Additional items (#{@quantity - 1} × 25% of base)", ((@quantity - 1) * @service.base_price_pence * 0.25).round)
    end

    same_region = collection.delivery_area.id == delivery.delivery_area.id
    if @service.same_day? && !same_region
      errors << "Same-day delivery is only available when collection and delivery are in the same region (#{collection.delivery_area.name} → #{delivery.delivery_area.name}). Try Express instead."
    end
    if @service.same_day? && @collection_date == Date.current && @service.cutoff_hour && Time.current.hour >= @service.cutoff_hour
      errors << "Same-day bookings for today must be made before #{@service.cutoff_hour}:00."
    end
    apply_surcharge(lines, "inter_region") unless same_region

    [["Collection", collection], ["Delivery", delivery]].each do |label, check|
      area = check.delivery_area
      lines << line("#{label} area surcharge (#{area.name})", area.surcharge_pence) if area.surcharge_pence.positive?
    end

    subtotal = lines.sum { _1[:amount_pence] }
    apply_surcharge(lines, "fragile", subtotal) if @fragile
    apply_surcharge(lines, "bulky", subtotal) if bulky?(chargeable)
    apply_surcharge(lines, "weekend_collection", subtotal) if @collection_date && !DeliveryCalendar.working_day?(@collection_date)

    return Result.new(ok: false, errors:, warnings:, lines: [], total_pence: nil, collection:, delivery:) if errors.any?

    total = lines.sum { _1[:amount_pence] }
    Result.new(
      ok: true, errors:, warnings:, lines:, total_pence: total,
      chargeable_weight_kg: chargeable.round(2), needs_review:,
      estimated_delivery_date: estimated_delivery_date(collection, delivery),
      collection:, delivery:
    )
  end

  private

  def chargeable_weight(warnings)
    if @weight_kg.nil?
      warnings << "No weight given – we've assumed #{ASSUMED_WEIGHT_KG} kg per item. The price may change once we know the actual weight."
    end
    actual = (@weight_kg || ASSUMED_WEIGHT_KG) * @quantity
    if @dims.all?
      volumetric = @dims.reduce(:*) / VOLUMETRIC_DIVISOR * @quantity
      return [actual, volumetric].max
    end
    warnings << "No dimensions given – the price may change if the item is larger than expected." if @dims.none?
    actual
  end

  def bulky?(chargeable)
    @dims.compact.any? { _1 > BULKY_DIMENSION_CM } || chargeable / @quantity > BULKY_WEIGHT_KG
  end

  def apply_surcharge(lines, code, subtotal = nil)
    surcharge = Surcharge.active.find_by(code:)
    return unless surcharge
    amount = surcharge.kind == "percent" ? ((subtotal || lines.sum { _1[:amount_pence] }) * surcharge.amount / 100.0).round : surcharge.amount
    label = surcharge.kind == "percent" ? "#{surcharge.name} (#{surcharge.amount}%)" : surcharge.name
    lines << line(label, amount) if amount.positive?
  end

  def estimated_delivery_date(collection, delivery)
    start = @collection_date || Date.current
    extra = [collection.delivery_area.extra_transit_days, delivery.delivery_area.extra_transit_days].max
    return start if @service.same_day? && extra.zero?
    DeliveryCalendar.add_working_days(start, @service.transit_days + extra)
  end

  def line(label, pence) = { label:, amount_pence: pence.to_i }

  def positive(value)
    f = value.presence && Float(value, exception: false)
    f&.positive? ? f : nil
  end

  def parse_date(value)
    return value if value.is_a?(Date)
    value.present? ? Date.parse(value.to_s) : nil
  rescue Date::Error
    nil
  end

  def fmt_kg(kg) = (kg % 1).zero? ? kg.to_i : kg.round(2)
end
