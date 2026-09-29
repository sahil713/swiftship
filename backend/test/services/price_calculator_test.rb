require "test_helper"

class PriceCalculatorTest < ActiveSupport::TestCase
  setup { seed_catalog! }

  def quote(service_slug: "standard", **opts)
    PriceCalculator.new(service: Service.find_by!(slug: service_slug), lookup: false,
                        collection_postcode: "SW1A 2AA", delivery_postcode: "SE1 7PB", **opts).call
  end

  test "same-region standard parcel within allowance is just the base price" do
    result = quote(weight_kg: 3, length_cm: 20, width_cm: 20, height_cm: 20, collection_date: Date.current.next_occurring(:monday))
    assert result.ok
    assert_equal 699, result.total_pence
    assert_empty result.warnings
  end

  test "volumetric weight is charged when greater than actual weight" do
    result = quote(weight_kg: 1, length_cm: 100, width_cm: 50, height_cm: 20) # 20 kg volumetric
    assert_equal 20.0, result.chargeable_weight_kg
    assert_equal 699 + 15 * 45, result.lines.sum { _1[:amount_pence] } - result.lines.select { _1[:label].start_with?("Weekend") }.sum { _1[:amount_pence] }
  end

  test "missing weight produces a warning that the price may change" do
    assert_match(/price may change/, quote.warnings.join)
  end

  test "rejects Irish Eircodes and Crown Dependencies" do
    result = PriceCalculator.new(service: Service.first, lookup: false, collection_postcode: "D02 X285", delivery_postcode: "JE2 3AB").call
    refute result.ok
    assert_match(/Republic of Ireland/, result.errors.first)
    assert_match(/Jersey/, result.errors.last)
  end

  test "northern ireland can be switched off" do
    Setting.set(:northern_ireland_enabled, false)
    result = PriceCalculator.new(service: Service.first, lookup: false, collection_postcode: "SW1A 2AA", delivery_postcode: "BT1 5GS").call
    refute result.ok
    assert_match(/Northern Ireland/, result.errors.first)
  end

  test "same day is refused across regions" do
    result = PriceCalculator.new(service: Service.find_by!(slug: "same-day"), lookup: false,
                                 collection_postcode: "SW1A 2AA", delivery_postcode: "M1 1AE", weight_kg: 1).call
    refute result.ok
    assert_match(/same region/, result.errors.join)
  end
end
