require "test_helper"

class BookingFlowTest < ActionDispatch::IntegrationTest
  setup do
    Rails.application.load_seed
    Setting.set(:pricing_enabled, true) # most tests cover the priced flow; phase 1 is tested separately
  end

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
    post "/api/v1/admin/bookings/#{ref}/assign_task", params: { kind: "collection", driver_id: driver.id }, headers: admin, as: :json
    assert_response :success, response.body
    collection = json.dig("booking", "tasks").find { _1["kind"] == "collection" }
    deliver_through_driver_portal(collection["id"], driver)
    booking = Booking.find_by!(reference: ref)
    get "/api/v1/track/#{booking.tracking_number.downcase}"
    assert_response :success
    assert_equal "delivered", json["status"]
    assert_equal %w[quote_requested awaiting_payment booked collected in_warehouse out_for_delivery delivered], json["events"].map { _1["status"] }
    refute_includes response.body, "Guest Sender", "tracking must not leak names"
    assert booking.notifications.where(channel: "email").exists?
    assert booking.notifications.where(channel: "email").all? { _1.subject.start_with?("Shift Logistics:") }
    assert booking.notifications.where(channel: "sms").all? { _1.body.start_with?("Shift Logistics:") }
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

  test "phase 1: with pricing disabled, requests are saved without a price and emailed to the admin" do
    Setting.set(:pricing_enabled, false)
    Setting.set(:enquiry_notification_email, "ops-inbox@example.com")
    ActionMailer::Base.deliveries.clear

    post "/api/v1/quotes", params: { service_id: Service.first.id, collection_postcode: "LS1 1UR", delivery_postcode: "YO1 7HH" }, as: :json
    assert_response :forbidden, "the live price calculator must be switched off"

    post "/api/v1/bookings", params: { booking: booking_params(special_requirements: "Two-person lift, 3rd floor no lift") }, as: :json
    assert_response :created
    booking = Booking.find_by!(reference: json.dig("booking", "reference"))
    assert_equal "quote_requested", booking.status
    assert_nil booking.estimated_price_pence
    assert_nil booking.confirmed_price_pence
    assert_nil json.dig("booking", "price_pence")
    assert_equal "Two-person lift, 3rd floor no lift", booking.special_requirements

    mail = ActionMailer::Base.deliveries.find { _1.to == ["ops-inbox@example.com"] }
    assert mail, "admin should receive the enquiry email"
    assert_equal [booking.customer_email], mail.reply_to
    assert_match booking.reference, mail.subject
    html = mail.html_part.decoded
    text = mail.text_part.decoded
    ["Guest Sender", "07700 900111", "1 High Street", "LS1 1UR", "YO1 7HH", "Box of plates", "Two-person lift, 3rd floor no lift"].each do |detail|
      assert_includes text, detail
      assert_includes html, ERB::Util.h(detail)
    end
    refute_match(/£/, text, "admin email shouldn't contain an automatic price")
    assert_match(/\AShift Logistics/, mail[:from].display_names.first.to_s)
    assert_includes text, "Shift Logistics — Powered by V&V Logistics and Rentals Ltd"
    assert_includes html, ERB::Util.h("Shift Logistics — Powered by V&V Logistics and Rentals Ltd")
    refute_match(/swiftship/i, text + html)
    assert booking.notifications.exists?(recipient: "ops-inbox@example.com", status: "sent")
  end

  test "phase 1: still rejects postcodes outside the service area" do
    Setting.set(:pricing_enabled, false)
    post "/api/v1/bookings", params: { booking: booking_params(delivery_postcode: "D02 X285") }, as: :json
    assert_response :unprocessable_entity
    assert_match(/Republic of Ireland/, json["error"])
  end

  test "phase 1: admin emails go to all admins when no address is configured" do
    Setting.set(:pricing_enabled, false)
    ActionMailer::Base.deliveries.clear
    post "/api/v1/bookings", params: { booking: booking_params }, as: :json
    assert_response :created
    assert ActionMailer::Base.deliveries.any? { _1.to.include?("admin@swiftship.example") }
  end

  test "phase 1: requests touching restricted areas are accepted and flagged for admin review" do
    Setting.set(:pricing_enabled, false)
    ActionMailer::Base.deliveries.clear
    post "/api/v1/bookings", params: { booking: booking_params(collection_postcode: "BH1 1AA", delivery_postcode: "TR1 2SN") }, as: :json
    assert_response :created
    booking = Booking.find_by!(reference: json.dig("booking", "reference"))
    assert booking.area_review
    assert_match(/Collection BH1 1AA:/, booking.area_review_notes)
    assert_match(/Delivery TR1 2SN:/, booking.area_review_notes)
    assert booking.notes.exists?(["body LIKE ?", "Service area review needed%"])

    mail = ActionMailer::Base.deliveries.last
    assert_match(/\A\[Area review\]/, mail.subject)
    assert_includes mail.text_part.decoded, "SERVICE AREA REVIEW NEEDED"
    assert_includes mail.html_part.decoded, "Service area review needed"

    get "/api/v1/admin/bookings", params: { area_review: "1" }, headers: auth_headers("admin@swiftship.example")
    assert_includes json["bookings"].map { _1["reference"] }, booking.reference
  end

  test "phase 1: normal areas are not flagged" do
    Setting.set(:pricing_enabled, false)
    post "/api/v1/bookings", params: { booking: booking_params }, as: :json
    assert_response :created
    refute Booking.find_by!(reference: json.dig("booking", "reference")).area_review
  end

  test "phase 1: Ireland is rejected at either end" do
    Setting.set(:pricing_enabled, false)
    [{ collection_postcode: "BT1 5GS" }, { delivery_postcode: "D02 X285" }].each do |override|
      post "/api/v1/bookings", params: { booking: booking_params(override) }, as: :json
      assert_response :unprocessable_entity
      assert_match(/Ireland/, json["error"])
    end
  end

  PHOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==".freeze
  SIGNATURE = "data:image/png;base64,iVBORw0KGgo=".freeze

  # Drives a job through the driver portal: POC → warehouse → (new delivery task) → POD → completed.
  def deliver_through_driver_portal(collection_task_id, driver)
    headers = auth_headers(driver.email)

    get "/api/v1/driver/tasks", headers: headers
    assert_includes json.map { _1["id"] }, collection_task_id

    post "/api/v1/driver/tasks/#{collection_task_id}/close", headers: headers, as: :json
    assert_response :unprocessable_entity, "can't close before proof of collection"

    post "/api/v1/driver/tasks/#{collection_task_id}/collect",
         params: { person_name: "Guest Sender", notes: "2 boxes, well packed", photos: [PHOTO, PHOTO] }, headers: headers, as: :json
    assert_response :success, response.body
    assert_equal "collected", json["status"]
    assert_equal "collected", json["booking_status"]
    assert_equal 2, json.dig("proof", "photos").size

    post "/api/v1/driver/tasks/#{collection_task_id}/close", params: { note: "Bay 4" }, headers: headers, as: :json
    assert_response :success, response.body
    assert_equal "closed", json["status"]
    assert_equal "in_warehouse", json["booking_status"]

    get "/api/v1/driver/tasks", headers: headers
    job_ref = DriverTask.find(collection_task_id).booking.reference
    delivery = json.find { _1["kind"] == "delivery" && _1["reference"] == job_ref }
    assert delivery, "a delivery task should be created for the driver"
    refute_includes json.map { _1["id"] }, collection_task_id, "closed task leaves the active list"

    post "/api/v1/driver/tasks/#{delivery['id']}/complete", headers: headers, as: :json
    assert_response :unprocessable_entity, "can't complete without POD"

    post "/api/v1/driver/tasks/#{delivery['id']}/proof", params: { person_name: "R. Receiver", photos: [PHOTO] }, headers: headers, as: :json
    assert_response :success
    post "/api/v1/driver/tasks/#{delivery['id']}/complete", headers: headers, as: :json
    assert_response :unprocessable_entity, "signature is required"

    post "/api/v1/driver/tasks/#{delivery['id']}/proof",
         params: { person_name: "R. Receiver", occurred_at: Time.current.iso8601, notes: "Handed over", photos: [PHOTO], signature_data: SIGNATURE },
         headers: headers, as: :json
    assert_response :success, response.body
    post "/api/v1/driver/tasks/#{delivery['id']}/complete", headers: headers, as: :json
    assert_response :success, response.body
    assert_equal "completed", json["status"]
    assert_equal "delivered", json["booking_status"]
  end

  test "drivers only see their own tasks" do
    booking = Booking.find_by!(status: "quote_requested")
    admin = auth_headers("admin@swiftship.example")
    post "/api/v1/admin/bookings/#{booking.reference}/assign_task", params: { kind: "collection", driver_id: User.find_by!(email: "driver@swiftship.example").id }, headers: admin, as: :json
    assert_response :unprocessable_entity, "collection needs a confirmed booking"
    assert_match(/Booked/, json["error"])

    post "/api/v1/admin/bookings/#{booking.reference}/status", params: { status: "booked", note: "Price agreed by phone" }, headers: admin, as: :json
    assert_response :success, response.body
    dan = User.find_by!(email: "driver@swiftship.example")
    post "/api/v1/admin/bookings/#{booking.reference}/assign_task", params: { kind: "collection", driver_id: dan.id }, headers: admin, as: :json
    assert_response :success
    task_id = json.dig("booking", "tasks").first["id"]

    get "/api/v1/driver/tasks/#{task_id}", headers: auth_headers("driver2@swiftship.example")
    assert_response :not_found
    get "/api/v1/driver/tasks/#{task_id}", headers: auth_headers(dan.email)
    assert_response :success
    assert_equal booking.collection_line1, json.dig("address", "line1")
  end

  test "admin sees POC and POD records on the job" do
    booking = Booking.find_by!(status: "quote_requested")
    admin = auth_headers("admin@swiftship.example")
    dan = User.find_by!(email: "driver@swiftship.example")
    post "/api/v1/admin/bookings/#{booking.reference}/status", params: { status: "booked" }, headers: admin, as: :json
    post "/api/v1/admin/bookings/#{booking.reference}/assign_task", params: { kind: "collection", driver_id: dan.id }, headers: admin, as: :json
    deliver_through_driver_portal(json.dig("booking", "tasks").first["id"], dan)

    get "/api/v1/admin/bookings/#{booking.reference}", headers: admin
    tasks = json.dig("booking", "tasks")
    assert_equal %w[collection delivery], tasks.map { _1["kind"] }
    assert_equal %w[closed completed], tasks.map { _1["status"] }
    assert_equal "Guest Sender", tasks[0].dig("proof", "person_name")
    assert_equal "R. Receiver", tasks[1].dig("proof", "person_name")
    assert tasks[1].dig("proof", "signature_data").present?
    assert_equal "Bay 4", tasks[0]["warehouse_note"]
  end
end
