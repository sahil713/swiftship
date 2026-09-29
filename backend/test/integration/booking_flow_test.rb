require "test_helper"

class BookingFlowTest < ActionDispatch::IntegrationTest
  setup { Rails.application.load_seed }

  def booking_params(overrides = {})
    {
      service_id: Service.find_by!(slug: "standard").id,
      collection_contact_name: "Guest Sender", collection_phone: "07700 900111", collection_email: "guest@example.com",
      collection_line1: "1 High Street", collection_city: "Leeds", collection_postcode: "ls11ur",
      delivery_contact_name: "Receiver", delivery_phone: "07700 900222", delivery_email: "r@example.com",
      delivery_line1: "2 Low Road", delivery_city: "York", delivery_postcode: "YO1 7HH",
      item_description: "Box of plates", quantity: 1, weight_kg: 4, fragile: true
    }.merge(overrides)
  end

  test "guest books, pays, driver delivers with proof, customer tracks" do
    post "/api/v1/bookings", params: { booking: booking_params }, as: :json
    assert_response :created
    ref = json.dig("booking", "reference")
    token = json["guest_token"]
    assert_equal "awaiting_payment", json.dig("booking", "status")
    assert_equal "LS1 1UR", json.dig("booking", "collection_postcode")

    get "/api/v1/bookings/#{ref}"
    assert_response :not_found, "booking must not be visible without the guest token"

    post "/api/v1/bookings/#{ref}/pay", params: { token:, card_number: "4000 0000 0000 0002", expiry: "12/30", cvc: "123" }, as: :json
    assert_response :payment_required

    post "/api/v1/bookings/#{ref}/pay", params: { token:, card_number: "4242 4242 4242 4242", expiry: "12/30", cvc: "123" }, as: :json
    assert_response :success
    assert_equal "booked", json.dig("booking", "status")
    assert_equal "paid", json.dig("booking", "payment_status")

    admin = auth_headers("admin@swiftship.example")
    driver = User.find_by!(email: "driver@swiftship.example")
    post "/api/v1/admin/bookings/#{ref}/assign_driver", params: { driver_id: driver.id }, headers: admin, as: :json
    assert_response :success

    driver_headers = auth_headers(driver.email)
    %w[collected in_transit out_for_delivery].each do |status|
      post "/api/v1/driver/jobs/#{ref}/status", params: { status: }, headers: driver_headers, as: :json
      assert_response :success, response.body
    end
    post "/api/v1/driver/jobs/#{ref}/status", params: { status: "delivered" }, headers: driver_headers, as: :json
    assert_response :unprocessable_entity, "delivery needs proof first"

    post "/api/v1/driver/jobs/#{ref}/proof_of_delivery",
         params: { recipient_name: "R. Receiver", signature_data: "data:image/png;base64,iVBORw0KGgo=" }, headers: driver_headers, as: :json
    assert_response :success, response.body
    assert_equal "delivered", json["status"]

    booking = Booking.find_by!(reference: ref)
    get "/api/v1/track/#{booking.tracking_number.downcase}"
    assert_response :success
    assert_equal "delivered", json["status"]
    assert_equal %w[quote_requested awaiting_payment booked collected in_transit out_for_delivery delivered], json["events"].map { _1["status"] }
    refute_includes response.body, "Guest Sender", "tracking must not leak names"
    assert booking.notifications.where(channel: "email").exists?
  end

  test "incomplete quotes wait for staff price confirmation" do
    post "/api/v1/bookings", params: { booking: booking_params(weight_kg: nil) }, as: :json
    assert_response :created
    ref = json.dig("booking", "reference")
    assert_equal "quote_requested", json.dig("booking", "status")

    ops = auth_headers("ops@swiftship.example")
    post "/api/v1/admin/bookings/#{ref}/confirm_price", params: { price_pence: 1500 }, headers: ops, as: :json
    assert_response :success
    assert_equal "awaiting_payment", json.dig("booking", "status")
    assert_equal 1500, json.dig("booking", "confirmed_price_pence")
  end

  test "outside service area is rejected with a clear message" do
    post "/api/v1/bookings", params: { booking: booking_params(delivery_postcode: "D02 X285") }, as: :json
    assert_response :unprocessable_entity
    assert_match(/Republic of Ireland/, json["error"])
  end

  test "customers can cancel unpaid bookings and see only their own" do
    customer = auth_headers("customer@example.com")
    post "/api/v1/bookings", params: { booking: booking_params }, headers: customer, as: :json
    ref = json.dig("booking", "reference")
    post "/api/v1/bookings/#{ref}/change_request", params: { kind: "cancellation" }, headers: customer, as: :json
    assert_response :created
    assert_equal "cancelled", json.dig("booking", "status")

    other = User.create!(name: "Other", email: "other@example.com", password: "password123")
    get "/api/v1/bookings/#{ref}", headers: { "Authorization" => "Bearer #{JsonWebToken.encode(other)}" }
    assert_response :not_found
  end

  test "role-based access: operations cannot change pricing, drivers cannot reach admin" do
    ops = auth_headers("ops@swiftship.example")
    patch "/api/v1/admin/services/#{Service.first.id}", params: { service: { base_price_pence: 1 } }, headers: ops, as: :json
    assert_response :forbidden

    get "/api/v1/admin/bookings", headers: auth_headers("driver@swiftship.example")
    assert_response :forbidden

    get "/api/v1/admin/bookings"
    assert_response :unauthorized
  end

  test "invalid status transitions are refused" do
    booking = Booking.find_by!(status: "quote_requested")
    post "/api/v1/admin/bookings/#{booking.reference}/status", params: { status: "delivered" }, headers: auth_headers("admin@swiftship.example"), as: :json
    assert_response :unprocessable_entity
    assert_match(/cannot change/, json["error"])
  end
end
