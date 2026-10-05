require "test_helper"

class ServiceAreaTest < ActiveSupport::TestCase
  setup { Rails.application.load_seed }

  def check(postcode) = ServiceArea.check(postcode, lookup: false)

  # Simulates a postcodes.io answer so location-based rules can be tested offline.
  def with_lookup(country:, latitude:)
    result = PostcodeLookup::Result.new(exists: true, verified: true, country:, latitude:, longitude: -4.0, district: "Test")
    original = PostcodeLookup.method(:call)
    PostcodeLookup.define_singleton_method(:call) { |_postcode| result }
    yield
  ensure
    PostcodeLookup.define_singleton_method(:call, original)
  end

  test "Ireland is always blocked – Republic of Ireland Eircodes" do
    %w[D02X285 A65F4E2 T12X70A].each do |eircode|
      result = check(eircode)
      refute result.ok, eircode
      assert_match(/Ireland/, result.message)
    end
  end

  test "Ireland is always blocked – Northern Ireland, even if the region is switched on" do
    DeliveryArea.find_by!(zone: "northern_ireland").update!(serviced: true)
    Setting.set(:northern_ireland_enabled, true)
    result = check("BT1 5GS")
    refute result.ok
    assert_match(/Northern Ireland/, result.message)
  end

  test "Northern Ireland can't be turned into a reviewable rule" do
    refute PostcodeRule.new(postcode_area: "BT", level: "restricted").valid?
  end

  test "normal UK areas are served without review" do
    ["SW1A 1AA", "M1 1AE", "G1 1XQ", "EH1 1YZ", "CF10 1EP", "EX1 1AA", "PL4 8AA", "B1 1AA", "LS1 1UR", "NE1 1AA", "KA1 1AA", "DG1 1AA"].each do |pc|
      result = check(pc)
      assert result.ok, pc
      refute result.review, "#{pc} should be a normal service area"
    end
  end

  test "areas we don't normally serve are accepted but flagged for review" do
    %w[IV1\ 1SY AB10\ 1AA TQ1\ 1AA TR1\ 2SN SY1\ 1AA KW1\ 4AA HS1\ 2AA ZE1\ 0AA PH1\ 1AA DD1\ 1AA].each do |pc|
      result = check(pc)
      assert result.ok, "#{pc} should still be submittable"
      assert result.review, "#{pc} should be flagged"
      assert_equal "outside", result.review_level, pc
      assert_match(/review/, result.message)
    end
  end

  test "rarely served areas are flagged as restricted" do
    %w[TN1\ 1AA BH1\ 1AA SO14\ 2AA].each do |pc|
      result = check(pc)
      assert result.ok
      assert_equal "restricted", result.review_level, pc
    end
  end

  test "Scottish postcodes north of Glasgow are flagged using their exact location" do
    with_lookup(country: "Scotland", latitude: 56.12) do # Stirling
      result = ServiceArea.check("FK8 1AA")
      assert result.ok
      assert_equal "outside", result.review_level
      assert_match(/North of Glasgow/, result.review_reason)
    end
  end

  test "Scottish postcodes at or south of Glasgow are served normally" do
    with_lookup(country: "Scotland", latitude: 55.84) do # Paisley
      refute ServiceArea.check("PA1 1AA").review
    end
    with_lookup(country: "Scotland", latitude: 55.95) do # Edinburgh
      refute ServiceArea.check("EH1 1YZ").review
    end
  end

  test "borderline Scottish areas are flagged when the exact location is unknown" do
    assert_equal "restricted", check("FK8 1AA").review_level
  end

  test "admins can add, change or switch off rules" do
    rule = PostcodeRule.find_by!(postcode_area: "SY")
    rule.update!(active: false)
    refute check("SY1 1AA").review

    PostcodeRule.create!(postcode_area: "NR", level: "restricted", note: "Norfolk – case by case")
    assert_equal "Norfolk – case by case", check("NR1 1AA").review_reason
  end

  test "review notes name each end that needs checking" do
    notes = ServiceArea.review_notes(collection: check("SW1A 1AA"), delivery: check("TR1 2SN"))
    assert_equal 1, notes.size
    assert_match(/\ADelivery TR1 2SN:/, notes.first)
  end
end
