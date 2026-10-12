require "test_helper"

class AdminOperationsTest < ActionDispatch::IntegrationTest
  setup do
    Rails.application.load_seed
    @admin = auth_headers("admin@swiftship.example")
    ActionMailer::Base.deliveries.clear
  end

  def new_booking(overrides = {})
    {
      customer_name: "Pat Phone", customer_email: "pat@example.com", customer_phone: "07700 900321",
      service_id: Service.first.id, collection_line1: "1 High St", collection_city: "Leeds", collection_postcode: "LS1 1UR",
      delivery_contact_name: "Dee Livery", delivery_phone: "07700 900654", delivery_email: "dee@example.com",
      delivery_line1: "2 Low Rd", delivery_city: "York", delivery_postcode: "YO1 7HH",
      item_description: "Sofa", quantity: 1, collection_date: (Date.current + 3).iso8601, collection_time: "10:30",
      special_requirements: "Two people needed", agreed_price: "120.00"
    }.merge(overrides)
  end

  test "admin creates a booking; booked bookings are paid; status survives a reload" do
    post "/api/v1/admin/bookings", params: { booking: new_booking(status: "booked") }, headers: @admin, as: :json
    assert_response :created, response.body
    ref = json.dig("booking", "reference")
    assert_equal "booked", json.dig("booking", "status")
    assert_equal "paid", json.dig("booking", "payment_status")
    assert_equal "Pat Phone", json.dig("booking", "collection_contact_name"), "collection contact defaults to the customer"
    assert_equal "10:30", json.dig("booking", "collection_time")
    assert_equal 12_000, json.dig("booking", "confirmed_price_pence")

    get "/api/v1/admin/bookings/#{ref}", headers: @admin
    assert_equal %w[booked paid], [json.dig("booking", "status"), json.dig("booking", "payment_status")]
  end

  test "admin can choose a different payment status when creating a booking" do
    post "/api/v1/admin/bookings", params: { booking: new_booking(status: "booked", payment_status: "partially_paid") }, headers: @admin, as: :json
    assert_equal "partially_paid", json.dig("booking", "payment_status")
  end

  test "office bookings follow the service-area rules" do
    post "/api/v1/admin/bookings", params: { booking: new_booking(delivery_postcode: "BT1 5GS") }, headers: @admin, as: :json
    assert_response :unprocessable_entity
    assert_match(/Ireland/, json["error"])
    post "/api/v1/admin/bookings", params: { booking: new_booking(delivery_postcode: "TR1 2SN") }, headers: @admin, as: :json
    assert_response :created
    assert json.dig("booking", "area_review")
  end

  test "quote request → Booked automatically sets payment to Paid, in the database and the history" do
    post "/api/v1/bookings", params: { booking: {
      service_id: Service.first.id, collection_contact_name: "Q", collection_phone: "07700 900111", collection_email: "q@example.com",
      collection_line1: "1 A St", collection_city: "Leeds", collection_postcode: "LS1 1UR", delivery_contact_name: "R",
      delivery_phone: "07700 900222", delivery_email: "r@example.com", delivery_line1: "2 B St", delivery_city: "York",
      delivery_postcode: "YO1 7HH", item_description: "Box" } }, as: :json
    ref = json.dig("booking", "reference")
    booking = Booking.find_by!(reference: ref)
    assert_equal %w[quote_requested unpaid], [booking.status, booking.payment_status]

    post "/api/v1/admin/bookings/#{ref}/status", params: { status: "booked" }, headers: @admin, as: :json
    assert_response :success
    booking.reload
    assert_equal %w[booked paid], [booking.status, booking.payment_status]
    assert_equal({ "payment_status" => ["Pending", "Paid"] }, booking.audit_logs.last.changes_made)

    get "/api/v1/admin/bookings", params: { q: ref }, headers: @admin
    assert_equal "Paid", json["bookings"].first["payment_status_label"]
  end

  test "admin updates the payment status manually and it is recorded" do
    booking = Booking.find_by!(status: "quote_requested")
    post "/api/v1/admin/bookings/#{booking.reference}/payment_status", params: { payment_status: "partially_paid", reason: "£50 deposit received" }, headers: @admin, as: :json
    assert_response :success
    assert_equal "partially_paid", json.dig("booking", "payment_status")
    assert_equal "£50 deposit received", json.dig("booking", "change_history", 0, "reason")
    post "/api/v1/admin/bookings/#{booking.reference}/payment_status", params: { payment_status: "bogus" }, headers: @admin, as: :json
    assert_response :unprocessable_entity
    assert_equal "partially_paid", booking.reload.payment_status
  end

  test "saved payment methods: admins manage them, office staff can use them" do
    post "/api/v1/admin/payment_methods", params: { payment_method: { name: "Business account", bank_name: "Barclays", account_name: "V&V Logistics and Rentals Ltd",
                                                                     account_number: "12345678", sort_code: "20-00-00", instructions: "Use your booking reference" } }, headers: @admin, as: :json
    assert_response :created
    post "/api/v1/admin/payment_methods", params: { payment_method: { name: "Empty" } }, headers: @admin, as: :json
    assert_response :unprocessable_entity, "needs an account number, IBAN or instructions"
    ops = auth_headers("ops@swiftship.example")
    get "/api/v1/admin/payment_methods", headers: ops
    assert_equal ["Business account"], json.map { _1["name"] }
    post "/api/v1/admin/payment_methods", params: { payment_method: { name: "X", instructions: "y" } }, headers: ops, as: :json
    assert_response :forbidden
  end

  test "payment details are emailed to the customer; text is reported as not sent while SMS isn't set up" do
    method = PaymentMethod.create!(name: "Business account", bank_name: "Barclays", account_name: "V&V Logistics and Rentals Ltd", account_number: "12345678", sort_code: "20-00-00")
    post "/api/v1/admin/bookings", params: { booking: new_booking(status: "booked", payment_status: "unpaid") }, headers: @admin, as: :json
    ref = json.dig("booking", "reference")
    ActionMailer::Base.deliveries.clear

    post "/api/v1/admin/bookings/#{ref}/send_payment_details", params: { payment_method_id: method.id, channels: %w[email sms], message: "Thanks!" }, headers: @admin, as: :json
    assert_response :success, response.body
    assert_equal %w[sent not_sent], json["results"].map { _1["status"] }
    assert_match(/SMS credits/, json["results"].last["error"])
    mail = ActionMailer::Base.deliveries.last
    assert_equal ["pat@example.com"], mail.to
    text = mail.text_part.decoded
    ["12345678", "20-00-00", "£120.00", ref, "Thanks!"].each { assert_includes text, _1 }
    booking = Booking.find_by!(reference: ref)
    assert_equal %w[email sms], booking.notifications.reorder(:id).last(2).map(&:channel)
  end

  test "admin creates a scheduled task from the Driver tasks screen and the driver sees it" do
    post "/api/v1/admin/bookings", params: { booking: new_booking(status: "booked") }, headers: @admin, as: :json
    ref = json.dig("booking", "reference")
    dan = User.find_by!(email: "driver@swiftship.example")

    post "/api/v1/admin/tasks", params: { task: { booking_reference: ref, kind: "delivery", driver_id: dan.id } }, headers: @admin, as: :json
    assert_response :unprocessable_entity, "delivery tasks only once items are at the depot"

    at = (Time.current + 2.days).change(hour: 9, min: 30)
    post "/api/v1/admin/tasks", params: { task: { booking_reference: ref.downcase, kind: "direct", driver_id: dan.id, scheduled_for: at.iso8601, instructions: "Ring the bell twice" } }, headers: @admin, as: :json
    assert_response :success, response.body
    task_id = json["id"]
    assert_equal "Task Assigned", json["status_label"]
    assert_equal "Ring the bell twice", json["instructions"]
    assert_equal "Paid", json.dig("booking", "payment_status_label")

    get "/api/v1/driver/tasks", headers: auth_headers(dan.email)
    mine = json.find { _1["id"] == task_id }
    assert mine, "the driver sees the new task"
    assert_equal "Ring the bell twice", mine["instructions"]

    patch "/api/v1/admin/tasks/#{task_id}", params: { task: { instructions: "Ring once" } }, headers: @admin, as: :json
    assert_equal "Ring once", json["instructions"]
    assert_equal "rescheduled", json["events"].last["action"]
    assert_equal({ "instructions" => ["Ring the bell twice", "Ring once"] }, json["corrections"].first["changes"])
  end

  test "driver messages the recipient; the message is emailed and recorded in the task history" do
    post "/api/v1/admin/bookings", params: { booking: new_booking(status: "booked") }, headers: @admin, as: :json
    ref = json.dig("booking", "reference")
    dan = User.find_by!(email: "driver@swiftship.example")
    post "/api/v1/admin/tasks", params: { task: { booking_reference: ref, kind: "direct", driver_id: dan.id } }, headers: @admin, as: :json
    task_id = json["id"]
    ActionMailer::Base.deliveries.clear

    h = auth_headers(dan.email)
    post "/api/v1/driver/tasks/#{task_id}/message", params: { side: "delivery", channels: %w[email], body: "Running 10 minutes late" }, headers: h, as: :json
    assert_response :success, response.body
    assert_equal "sent", json["message_results"].first["status"]
    assert_equal ["dee@example.com"], ActionMailer::Base.deliveries.last.to
    assert_includes ActionMailer::Base.deliveries.last.text_part.decoded, "Running 10 minutes late"
    event = json["events"].last
    assert_equal "customer_messaged", event["action"]
    assert_match(/Dee Livery/, event["note"])

    post "/api/v1/driver/tasks/#{task_id}/message", params: { side: "delivery", channels: %w[email], body: "" }, headers: h, as: :json
    assert_response :unprocessable_entity
    post "/api/v1/driver/tasks/#{task_id}/message", params: { side: "delivery", channels: %w[email], body: "Hi" }, headers: auth_headers("driver2@swiftship.example"), as: :json
    assert_response :not_found, "another driver can't message about this task"

    # A collection-only task can't be used to contact the delivery recipient.
    post "/api/v1/admin/tasks", params: { task: { booking_reference: ref, kind: "collection", driver_id: dan.id } }, headers: @admin, as: :json
    assert_response :unprocessable_entity, "booking already has a direct task"
    other = Booking.find_by!(reference: ref).driver_tasks.first
    other.update_columns(kind: "collection")
    post "/api/v1/driver/tasks/#{other.id}/message", params: { side: "delivery", channels: %w[email], body: "Hello there" }, headers: h, as: :json
    assert_response :unprocessable_entity
  end

  test "editing a task with blank values records no change" do
    post "/api/v1/admin/bookings", params: { booking: new_booking(status: "booked") }, headers: @admin, as: :json
    post "/api/v1/admin/tasks", params: { task: { booking_reference: json.dig("booking", "reference"), kind: "collection" } }, headers: @admin, as: :json
    id = json["id"]
    patch "/api/v1/admin/tasks/#{id}", params: { task: { scheduled_for: "", instructions: "" } }, headers: @admin, as: :json
    assert_response :success
    assert_empty json["events"].select { _1["action"] == "rescheduled" }
    get "/api/v1/admin/bookings", headers: @admin
    assert json["bookings"].first.key?("customer_name")
  end
end
